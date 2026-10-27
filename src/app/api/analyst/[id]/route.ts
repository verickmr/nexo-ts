import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertOrigin, AppError, route } from '@/lib/errors';
import { addSystem } from '@/services/conversations';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return route(async () => {
  assertOrigin(request); const actor = await requireUser('ANALYST');
  const { action } = z.object({ action: z.enum(['CLAIM', 'RETURN', 'CLOSE']) }).parse(await request.json());
  const { id } = await context.params;
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
    const conversation = await tx.conversation.findUnique({ where: { id } });
    if (!conversation) throw new AppError(404, 'Conversa não encontrada.');
    if (conversation.state === 'CLOSED') throw new AppError(409, 'Esta conversa já foi encerrada.');
    if (action === 'CLAIM') {
      if (conversation.state === 'HUMAN') throw new AppError(409, 'Outro analista já assumiu esta conversa.');
      await tx.conversation.update({ where: { id }, data: { state: 'HUMAN', assignedToId: actor.id, activeRunId: null, runStartedAt: null, version: { increment: 1 } } });
      await addSystem(tx, id, `${actor.name} assumiu o atendimento. Agent pausado.`);
    } else {
      if (conversation.state === 'HUMAN' && conversation.assignedToId !== actor.id) throw new AppError(403, 'Somente o analista responsável pode alterar este atendimento.');
      if (conversation.state === 'AGENT') throw new AppError(409, 'Assuma o atendimento primeiro.');
      await tx.conversation.update({ where: { id }, data: { state: action === 'RETURN' ? 'AGENT' : 'CLOSED', assignedToId: null, activeRunId: null, runStartedAt: null, context: {}, version: { increment: 1 } } });
      await addSystem(tx, id, action === 'RETURN' ? `${actor.name} devolveu a conversa ao Nexo Assist.` : `${actor.name} encerrou o atendimento. O status dos chamados permanece no histórico.`);
    }
  });
  return Response.json({ ok: true });
}); }
