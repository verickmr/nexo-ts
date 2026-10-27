// Explicit opt-in fixture adapter for offline demos/e2e. Never a fallback for an LLM failure.
import { decisionSchema, type Decision } from '@/domain/types';
export function scriptedDecision(message: string, context: Partial<Decision> = {}): Decision {
  const text = message
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const base: Decision = {
    intent: 'CLARIFY',
    confidence: 0.92,
    reason: 'Cenário roteirizado para testes sem LLM.',
    ticketId: null,
    title: null,
    description: null,
    type: null,
    category: null,
    impact: null,
    urgency: null,
    articleIds: [],
    question: null,
    options: [],
    ...context,
  };
  if (/analista|atendente|pessoa|humano/.test(text))
    return decisionSchema.parse({ ...base, intent: 'HANDOFF' });
  if (/ferias|salario|reembolso|vale refeicao|ar condicionado/.test(text))
    return { ...base, intent: 'OUT_OF_SCOPE' };
  if (/status|andamento|meus chamados|meu chamado|situacao/.test(text))
    return { ...base, intent: 'STATUS', ticketId: null };
  const number = message.match(/(?:INC|REQ)-\d+/i)?.[0]?.toUpperCase();
  if (number)
    return {
      ...base,
      intent: /adicionar|complementar|atualizar|continua|voltou/.test(text) ? 'UPDATE' : 'STATUS',
      ticketId: number,
      description: message,
    };
  if (/horario|atendimento|abre que horas/.test(text))
    return { ...base, intent: 'QUESTION', articleIds: ['horario'] };
  if (/como|configurar|instalar|redefinir/.test(text) && /senha|outlook|wi.?fi/.test(text))
    return {
      ...base,
      intent: 'QUESTION',
      articleIds: [/senha/.test(text) ? 'senha' : /outlook/.test(text) ? 'outlook' : 'wifi'],
    };
  if (
    /vpn|notebook|monitor|sap|software|computador|impressora|acesso|outlook|mouse/.test(text) ||
    context.title
  ) {
    base.intent = context.intent === 'UPDATE' ? 'UPDATE' : 'CREATE';
    base.title ||= /vpn/.test(text)
      ? 'VPN não conecta no notebook — erro 809'
      : /monitor/.test(text)
        ? 'Solicitação de segundo monitor'
        : /sap/.test(text)
          ? 'Acesso ao SAP bloqueado'
          : /outlook/.test(text)
            ? 'Outlook não sincroniza'
            : 'Problema no notebook';
    base.description = [context.description, message].filter(Boolean).join('\n').slice(-4000);
    base.category ||= /vpn|internet|rede/.test(text)
      ? 'NETWORK'
      : /sap|acesso|senha/.test(text)
        ? 'ACCESS'
        : /outlook|email/.test(text)
          ? 'EMAIL'
          : 'HARDWARE';
    base.type ||= /preciso de|solicito|quero um|segundo monitor|instalar/.test(text)
      ? 'REQ'
      : 'INC';
    if (/so eu|somente eu|apenas eu/.test(text)) base.impact = 'PERSON';
    if (/equipe/.test(text)) base.impact = 'TEAM';
    if (/empresa/.test(text)) base.impact = 'COMPANY';
    if (/reuniao|hoje|14h|compromisso/.test(text)) base.urgency = 'TODAY';
    if (/ninguem|parad|impede|impossivel|nao consigo trabalhar|sem alternativa/.test(text))
      base.urgency = 'BLOCKED';
    if (
      /alternativa|contornar|consigo trabalhar/.test(text) &&
      !/sem alternativa|nao consigo trabalhar/.test(text)
    )
      base.urgency = 'WORKAROUND';
    if (/sem urgencia|pode esperar|melhoria/.test(text)) base.urgency = 'NO_RUSH';
    return base;
  }
  return {
    ...base,
    confidence: 0.5,
    question: 'Pode descrever o problema de TI com mais detalhes?',
  };
}
