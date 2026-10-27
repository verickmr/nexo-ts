import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { publicUser } from '@/lib/auth';
import type { User, Prisma } from '@/generated/prisma/client';
import { ticketService } from './tickets';
export async function authorizeConversation(id: string, actor: User) {
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: { owner: true, assignedTo: true },
  });
  if (!conversation || (actor.role !== 'ANALYST' && conversation.ownerId !== actor.id))
    throw new AppError(404, 'Conversa não encontrada.');
  return conversation;
}
export async function snapshot(id: string, actor: User) {
  const conversation = await authorizeConversation(id, actor);
  const [messages, drafts, tickets] = await Promise.all([
    db.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.draft.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' } }),
    ticketService.list(conversation.ownerId),
  ]);
  return {
    ...conversation,
    owner: publicUser(conversation.owner),
    assignedTo: conversation.assignedTo ? publicUser(conversation.assignedTo) : null,
    messages,
    drafts,
    tickets,
  };
}
export async function addSystem(
  tx: Prisma.TransactionClient,
  conversationId: string,
  content: string,
) {
  return tx.message.create({ data: { conversationId, role: 'SYSTEM', content } });
}
export async function transferConversation(
  conversationId: string,
  reason: string,
  summary: string,
  team = 'Suporte N2',
  expectedRunId?: string,
) {
  return db.$transaction(async (tx) => {
    const changed = await tx.conversation.updateMany({
      where: {
        id: conversationId,
        state: 'AGENT',
        ...(expectedRunId ? { activeRunId: expectedRunId } : {}),
      },
      data: {
        state: 'WAITING_ANALYST',
        activeRunId: null,
        runStartedAt: null,
        assignedToId: null,
        handoffReason: reason,
        handoffSummary: summary,
        handoffTeam: team,
        handedOffAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (changed.count)
      await addSystem(
        tx,
        conversationId,
        `Conversa transferida para ${team}. Agent pausado. Motivo: ${reason}`,
      );
    return changed.count > 0;
  });
}
