import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { decisionSchema, ticketInput, type Decision, type DecisionTrace, type MessageMetadata } from '@/domain/types';
import { classifyPriority, dueDate, isOverdue, canReopen } from '@/domain/sla';
import { categories, priorities } from '@/domain/types';
import { authorizeConversation, transferConversation } from '@/services/conversations';
import { ticketService, findDuplicate } from '@/services/tickets';
import { searchArticles } from '@/services/knowledge';
import { rateLimit } from '@/services/limits';
import { decide, streamAnswer } from './mastra';
import type { User, Prisma } from '@/generated/prisma/client';
export type Emit = (event: string, value: unknown) => void;
export type TurnInput = { text: string; requestKey: string; action?: 'STATUS' | 'TICKET' | 'HANDOFF'; ticketId?: string };

export async function admitTurn(id: string, actor: User, input: TurnInput) {
  await rateLimit(`message:${actor.id}`, Number(process.env.MAX_MESSAGES_PER_MINUTE || 6), 60000);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
    const conversation = await tx.conversation.findUnique({ where: { id } });
    if (!conversation || conversation.ownerId !== actor.id) throw new AppError(404, 'Conversa não encontrada.');
    const existing = await tx.message.findUnique({ where: { conversationId_requestKey: { conversationId: id, requestKey: input.requestKey } } });
    if (existing) return { replay: true, runId: null, messageId: existing.id };
    if (conversation.state === 'CLOSED') throw new AppError(409, 'Esta conversa foi encerrada. Inicie um novo atendimento.');
    const handoff = input.action === 'HANDOFF';
    const requiresAgent = conversation.state === 'AGENT' && !handoff;
    if (requiresAgent && conversation.messageCount >= 30) throw new AppError(429, 'Você chegou a 30 mensagens com o agent. Fale com um analista ou inicie outra conversa.', 'SESSION_LIMIT');
    if (requiresAgent && conversation.activeRunId && conversation.runStartedAt && Date.now() - conversation.runStartedAt.getTime() < 120000) throw new AppError(409, 'Aguarde a resposta atual antes de enviar outra mensagem.');
    const runId = requiresAgent ? randomUUID() : null;
    const message = await tx.message.create({ data: { conversationId: id, role: 'USER', content: input.text, requestKey: input.requestKey } });
    await tx.conversation.update({ where: { id }, data: {
      ...(requiresAgent ? { activeRunId: runId, runStartedAt: new Date(), messageCount: { increment: 1 } } : {}),
      ...(conversation.title === 'Novo atendimento' ? { title: input.text.slice(0, 70) } : {}), version: { increment: 1 }
    } });
    return { replay: false, runId, messageId: message.id };
  });
}
function mergeContext(previous: Partial<Decision>, decision: Decision): Decision {
  if (!['CREATE', 'UPDATE', 'CLARIFY'].includes(decision.intent)) return decision;
  const changedSubject = decision.title && previous.title && decision.category !== previous.category && decision.intent === 'CREATE';
  if (changedSubject) return decision;
  const result = { ...decision };
  for (const key of ['title', 'description', 'type', 'category', 'impact', 'urgency', 'ticketId'] as const) {
    if (key === 'ticketId' && decision.intent === 'CREATE') continue;
    if (result[key] === null && previous[key] != null) Object.assign(result, { [key]: previous[key] });
  }
  return result;
}
const ruleDecision = (intent: Decision['intent'], ticketId: string | null = null): Decision => ({ intent, ticketId, confidence: 1, reason: 'Ação escolhida explicitamente pelo funcionário.', title: null, description: null, type: null, category: null, impact: null, urgency: null, articleIds: [], question: null, options: [] });
export async function attend(id: string, actor: User, input: TurnInput, runId: string, emit: Emit) {
  const started = Date.now();
  const trace: DecisionTrace = { intent: '', confidence: 0, reason: '', rules: [], actions: [], sources: [], durationMs: 0, model: process.env.AI_MODE === 'scripted' ? 'roteiro de demonstração' : process.env.LLM_MODEL || 'groq/openai/gpt-oss-120b', tokens: 0 };
  const active = async () => !!await db.conversation.findFirst({ where: { id, state: 'AGENT', activeRunId: runId } });
  const action = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    emit('action', { label, status: 'running' }); const begin = Date.now();
    try { const result = await fn(); trace.actions.push({ label, result: 'Concluído', durationMs: Date.now() - begin, success: true }); emit('action', { label, status: 'done' }); return result; }
    catch (error) { trace.actions.push({ label, result: 'Indisponível', durationMs: Date.now() - begin, success: false }); emit('action', { label, status: 'error' }); throw error; }
  };
  try {
    const conversation = await authorizeConversation(id, actor);
    const parsedContext = decisionSchema.partial().safeParse(conversation.context);
    const context = parsedContext.success ? parsedContext.data : {};
    const [tickets, articles, history] = await Promise.all([
      action('consultou seus chamados', () => ticketService.list(actor.id)),
      action('buscou na central de ajuda', () => searchArticles(`${input.text} ${context.title || ''}`, actor.os)),
      db.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'desc' }, take: 8, select: { role: true, content: true } })
    ]);
    const explicitNumber = input.text.match(/\b(?:INC|REQ)-\d+\b/i)?.[0]?.toUpperCase();
    const foreignNumber = explicitNumber && !tickets.some(t => t.number === explicitNumber);
    let decision: Decision;
    if (input.action === 'STATUS') decision = ruleDecision('STATUS');
    else if (input.action === 'TICKET') decision = ruleDecision('STATUS', input.ticketId || null);
    else if (foreignNumber) decision = ruleDecision('STATUS', explicitNumber);
    else decision = await action('interpretou sua mensagem', () => decide({
      message: input.text, context: JSON.stringify(context),
      history: history.reverse().map(m => `${m.role}: ${m.content.slice(0, 500)}`).join('\n').slice(-3500),
      evidence: JSON.stringify({ user: { os: actor.os }, tickets: tickets.slice(0, 12).map(t => ({ id: t.id, number: t.number, title: t.title, category: t.category, status: t.status, resolvedAt: t.resolvedAt })), articles: articles.map(a => ({ id: a.id, title: a.title, body: a.body, applicable: a.applicable })) })
    }));
    decision = mergeContext(context, decision);
    trace.intent = decision.intent; trace.confidence = decision.confidence; trace.reason = decision.reason;
    let content = ''; const metadata: MessageMetadata = {};
    let escalate: { reason: string; summary: string } | null = null;
    const selected = decision.ticketId ? tickets.find(t => t.id === decision.ticketId || t.number === decision.ticketId) : null;
    if (decision.intent === 'UPDATE' && selected) {
      decision = { ...decision, title: decision.title || selected.title, description: decision.description || input.text,
        type: decision.type || selected.type, category: decision.category || selected.category,
        impact: decision.impact || ticketInput.shape.impact.parse(selected.impact), urgency: decision.urgency || ticketInput.shape.urgency.parse(selected.urgency) };
    }
    if (decision.intent === 'HANDOFF') {
      content = 'Vou encaminhar a conversa para um analista com o histórico do atendimento. O agent ficará pausado até a equipe devolvê-la.';
      escalate = { reason: 'Pedido do funcionário', summary: `${actor.name}: ${input.text}. ${context.description || ''}` };
    } else if (decision.intent === 'OUT_OF_SCOPE') {
      trace.rules.push('Atendimento restrito a TI'); content = 'Posso ajudar com assuntos de TI. Para férias, benefícios ou salário, procure o RH; para reembolsos, o Financeiro; para instalações, Facilities. Nenhum chamado foi aberto.';
    } else if (decision.confidence < 0.65) {
      trace.rules.push('Encaminhar decisões com baixa confiança');
      content = 'Não tenho segurança suficiente para decidir o encaminhamento. Vou chamar um analista e enviar o contexto para você não precisar explicar tudo de novo.';
      escalate = { reason: 'Baixa confiança na decisão', summary: `${decision.reason}\n${input.text}` };
    } else if (decision.intent === 'STATUS') {
      trace.rules.push('Somente chamados do próprio funcionário');
      if (decision.ticketId && !selected) content = 'Não encontrei esse chamado entre os seus registros. Confira o número ou selecione um dos seus chamados.';
      else if (!selected) {
        const open = tickets.filter(t => t.status !== 'RESOLVED'); metadata.ticketIds = open.map(t => t.id);
        content = open.length ? `Você tem ${open.length} chamado${open.length > 1 ? 's' : ''} aberto${open.length > 1 ? 's' : ''}. Sobre qual deles quer saber?` : 'Você não tem chamados abertos. Posso ajudar a resolver uma dúvida ou iniciar um novo chamado.';
      } else {
        metadata.ticketIds = [selected.id];
        const overdue = isOverdue(selected);
        trace.actions.push({ label: 'calculou o prazo', result: overdue ? 'Prazo vencido' : 'Dentro do prazo', success: true, durationMs: 0 });
        content = overdue ? `O ${selected.number} está com o prazo de atualização vencido. Vou encaminhar o atendimento a um analista com o histórico.` : `Aqui está o ${selected.number}. O prazo exibido vale para resposta ou atualização. Você pode adicionar informações ao chamado.`;
        metadata.options = overdue ? undefined : ['Adicionar informação', 'Falar com um analista'];
        if (overdue) escalate = { reason: 'Chamado com SLA vencido', summary: `${selected.number}: ${selected.title}. Prazo: ${selected.dueAt.toISOString()}. ${input.text}` };
        decision.ticketId = selected.id;
      }
    } else if (decision.intent === 'QUESTION') {
      const usable = articles.filter(a => a.applicable && (decision.articleIds.includes(a.id) || !decision.articleIds.length));
      if (usable.length) {
        trace.sources = usable.map(a => ({ id: a.id, title: a.title })); metadata.articleIds = usable.map(a => a.id);
        content = usable.map(a => a.body).join('\n\n'); metadata.options = ['Isso resolveu', 'Preciso de mais ajuda', 'Falar com um analista'];
      } else {
        content = 'Não encontrei uma orientação aplicável ao seu caso na central de ajuda. Descreva o problema e quem está sendo afetado para eu preparar o encaminhamento.';
        trace.rules.push('Artigos precisam ser aplicáveis ao ambiente');
      }
    } else if (decision.intent === 'CREATE' || decision.intent === 'UPDATE') {
      trace.rules.push('Confirmação antes de gravar', 'Sem duplicidade');
      const duplicate = decision.title && decision.category ? findDuplicate(tickets, decision.title, decision.category) : undefined;
      const candidate = selected || duplicate;
      const target = candidate?.status === 'RESOLVED' && !canReopen(candidate.resolvedAt) ? undefined : candidate;
      if (!target) decision.ticketId = null;
      if (target) { decision.ticketId = target.id; metadata.ticketIds = [target.id]; }
      if (!decision.title || !decision.description || !decision.type || !decision.category) {
        content = decision.question || 'O que aconteceu, quando começou e qual equipamento ou sistema está envolvido?';
      } else if (!decision.impact) {
        content = 'Entendi o problema. Quem está sendo afetado?'; metadata.options = ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'];
      } else if (!decision.urgency) {
        content = 'Isso impede o trabalho ou há algum compromisso em risco?'; metadata.options = ['Não consigo trabalhar', 'Tenho um compromisso hoje', 'Consigo usar uma alternativa', 'Sem urgência'];
      } else if (target?.status === 'RESOLVED' && !canReopen(target.resolvedAt)) {
        content = 'Esse chamado foi resolvido há mais de sete dias. Podemos preparar um novo chamado para este problema.'; decision.ticketId = null;
      } else {
        const data = ticketInput.parse({ title: decision.title, description: target && decision.intent === 'UPDATE' ? `${target.description}\n\nComplemento: ${decision.description}` : decision.description, type: decision.type, category: decision.category, impact: decision.impact, urgency: decision.urgency });
        const priority = classifyPriority(data.impact, data.urgency);
        trace.actions.push({ label: 'classificou a prioridade', result: `${priorities[priority]} · ${categories[data.category]}`, success: true, durationMs: 0 });
        const draft = await db.$transaction(async tx => {
          const current = await tx.conversation.findUnique({ where: { id } });
          if (current?.state !== 'AGENT' || current.activeRunId !== runId) throw new AppError(409, 'O atendimento mudou de responsável.');
          await tx.draft.updateMany({ where: { conversationId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
          return tx.draft.create({ data: { conversationId: id, operation: target ? target.status === 'RESOLVED' ? 'REOPEN' : 'UPDATE' : 'CREATE', ticketId: target?.id, ticketVersion: target?.version, data: { ...data, priority, dueAt: dueDate(priority).toISOString() } } });
        });
        metadata.draftId = draft.id;
        trace.actions.push({ label: 'montou o rascunho', result: draft.id, success: true, durationMs: 0 });
        content = target ? `Encontrei o ${target.number} para esse problema. Preparei ${target.status === 'RESOLVED' ? 'a reabertura' : 'uma atualização'}, evitando duplicidade. Confira o rascunho antes de confirmar.` : `Preparei um rascunho com prioridade ${priorities[priority].toLowerCase()}. Confira os dados antes de confirmar a abertura. O prazo é para resposta, não para resolução.`;
        if (priority === 'CRITICAL') { trace.rules.push('Incidente crítico exige analista'); content += ' Como o trabalho da equipe está parado, vou chamar um analista agora. O rascunho ainda não foi gravado como chamado.'; escalate = { reason: 'Incidente crítico', summary: JSON.stringify(data) }; }
      }
    } else {
      content = decision.question || 'Pode descrever o que está acontecendo com o equipamento ou sistema?'; metadata.options = decision.options;
    }
    if (!await active()) return;
    await db.conversation.updateMany({ where: { id, state: 'AGENT', activeRunId: runId }, data: { context: decision as unknown as Prisma.InputJsonValue } });
    // Only grounded knowledge answers use the second LLM call; business operations use server-authored facts.
    if (decision.intent === 'QUESTION' && metadata.articleIds?.length && process.env.AI_MODE !== 'scripted') {
      let streamed = '';
      try { streamed = await streamAnswer(JSON.stringify({ facts: content, question: input.text, os: actor.os }), async text => { emit('text', { text }); }, active); }
      catch { trace.actions.push({ label: 'respondeu com o artigo original', result: 'Geração de texto indisponível; conteúdo da base preservado.', success: true, durationMs: 0 }); }
      if (streamed) content = streamed;
    }
    if (!await active()) return;
    trace.durationMs = Date.now() - started; metadata.trace = trace; metadata.handoff = !!escalate;
    await db.$transaction(async tx => {
      // Lock the state check and final message together with analyst takeover transactions.
      await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.conversation.findUnique({ where: { id } });
      if (current?.state !== 'AGENT' || current.activeRunId !== runId) return;
      const message = await tx.message.create({ data: { conversationId: id, role: 'ASSISTANT', content, metadata: metadata as Prisma.InputJsonValue } });
      await tx.conversation.update({ where: { id }, data: { activeRunId: null, runStartedAt: null, version: { increment: 1 } } });
      emit('message', message);
    });
    if (escalate) await transferConversation(id, escalate.reason, escalate.summary);
    emit('done', { conversationId: id });
  } finally {
    await db.conversation.updateMany({ where: { id, activeRunId: runId }, data: { activeRunId: null, runStartedAt: null } });
  }
}
