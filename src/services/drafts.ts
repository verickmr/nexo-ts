import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { ticketInput } from '@/domain/types';
import { classifyPriority, dueDate, canReopen } from '@/domain/sla';
import { findDuplicate, withLegacyRetry } from './tickets';
import type { Prisma, User } from '@/generated/prisma/client';
import { authorizeConversation } from './conversations';
export async function confirmDraft(id: string, version: number, actor: User) {
  return withLegacyRetry(() => db.$transaction(async tx => {
    // Serialize writes per employee, including confirmations in separate conversations.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR UPDATE`;
    const draft = await tx.draft.findUnique({ where: { id }, include: { conversation: true } });
    if (!draft || draft.conversation.ownerId !== actor.id) throw new AppError(404, 'Rascunho não encontrado.');
    if (draft.status === 'CONFIRMED' && draft.resultTicketId) return tx.ticket.findUniqueOrThrow({ where: { id: draft.resultTicketId } });
    if (draft.status !== 'PENDING' || draft.version !== version) throw new AppError(409, 'O rascunho mudou. Confira a versão atual antes de confirmar.');
    if (draft.conversation.state !== 'AGENT') throw new AppError(409, 'O atendimento está com um analista. A criação pelo agent está pausada.');
    const input = ticketInput.parse(draft.data);
    const priority = classifyPriority(input.impact, input.urgency); const now = new Date();
    const ownTickets = await tx.ticket.findMany({ where: { ownerId: actor.id } });
    const duplicate = findDuplicate(ownTickets, input.title, input.category);
    let targetId = draft.ticketId;
    // A new duplicate discovered after preview requires a new confirmation for an update.
    if (draft.operation === 'CREATE' && duplicate) {
      await tx.draft.update({ where: { id }, data: { operation: duplicate.status === 'RESOLVED' ? 'REOPEN' : 'UPDATE', ticketId: duplicate.id, ticketVersion: duplicate.version, version: { increment: 1 } } });
      return { needsReconfirmation: true as const };
    }
    let ticket;
    if (targetId) {
      const existing = ownTickets.find(t => t.id === targetId);
      if (!existing) throw new AppError(404, 'Chamado não encontrado.');
      if (existing.version !== draft.ticketVersion) {
        await tx.draft.update({ where: { id }, data: { ticketVersion: existing.version, version: { increment: 1 }, data: { ...input, description: `${existing.description}\n\nComplemento aguardando confirmação:\n${input.description}`, priority, dueAt: dueDate(priority).toISOString() } } });
        return { needsReconfirmation: true as const };
      }
      if (existing.status === 'RESOLVED' && !canReopen(existing.resolvedAt)) throw new AppError(409, 'Este chamado foi resolvido há mais de sete dias. Abra um novo atendimento.');
      ticket = await tx.ticket.update({ where: { id: existing.id }, data: {
        ...input, priority, dueAt: dueDate(priority, now), lastServiceUpdateAt: now, version: { increment: 1 },
        ...(existing.status === 'RESOLVED' ? { status: 'OPEN', resolvedAt: null } : {}),
        updates: { create: { author: actor.name, content: input.description } }
      } });
    } else {
      const counter = await tx.counter.upsert({ where: { key: input.type }, create: { key: input.type, value: input.type === 'INC' ? 20521 : 10451 }, update: { value: { increment: 1 } } });
      ticket = await tx.ticket.create({ data: { ...input, priority, number: `${input.type}-${counter.value}`, ownerId: actor.id, dueAt: dueDate(priority, now), updates: { create: { author: actor.name, content: 'Chamado criado após confirmação do funcionário.' } } } });
    }
    await tx.draft.update({ where: { id }, data: { status: 'CONFIRMED', resultTicketId: ticket.id } });
    await tx.conversation.update({ where: { id: draft.conversationId }, data: { context: {}, version: { increment: 1 } } });
    await tx.message.create({ data: { conversationId: draft.conversationId, role: 'ASSISTANT', content: `${targetId ? 'Atualizei' : 'Criei'} o chamado ${ticket.number} após sua confirmação. A prioridade é ${priority === 'HIGH' ? 'alta' : priority === 'CRITICAL' ? 'crítica' : priority === 'MEDIUM' ? 'média' : 'baixa'}; o prazo exibido é para resposta ou atualização, não para resolução.`, metadata: { ticketIds: [ticket.id], trace: { intent: draft.operation, confidence: 1, reason: 'Confirmação explícita do funcionário sobre o rascunho apresentado.', rules: ['Confirmação obrigatória', 'Isolamento por funcionário', 'Sem duplicidade'], sources: [], durationMs: 0, model: 'regra do servidor', tokens: 0, actions: [{ label: targetId ? 'atualizou o chamado' : 'criou o chamado', result: ticket.number, success: true, durationMs: 0 }] } } } });
    return ticket;
  }, { timeout: 15000 }));
}
export async function changeDraft(id: string, actor: User, action: 'EDIT' | 'CANCEL', version: number, data?: unknown) {
  const draft = await db.draft.findUnique({ where: { id } });
  if (!draft) throw new AppError(404, 'Rascunho não encontrado.');
  const conversation = await authorizeConversation(draft.conversationId, actor);
  if (actor.id !== conversation.ownerId) throw new AppError(403, 'Só o funcionário pode confirmar ou editar seu rascunho.');
  if (conversation.state !== 'AGENT') throw new AppError(409, 'O agent está pausado.');
  const input = action === 'EDIT' ? ticketInput.parse(data) : null;
  const value = input ? { ...input, priority: classifyPriority(input.impact, input.urgency), dueAt: dueDate(classifyPriority(input.impact, input.urgency)).toISOString() } : undefined;
  const changed = await db.draft.updateMany({ where: { id, version, status: 'PENDING' }, data: { version: { increment: 1 }, ...(value ? { data: value as Prisma.InputJsonValue } : { status: 'CANCELLED' }) } });
  if (!changed.count) throw new AppError(409, 'O rascunho mudou. Atualize a página.');
  if (action === 'CANCEL') {
    await db.conversation.update({ where: { id: conversation.id }, data: { context: {} } });
    await db.message.create({ data: { conversationId: conversation.id, role: 'SYSTEM', content: 'Rascunho cancelado pelo funcionário. Nenhum chamado foi alterado.' } });
  }
}
