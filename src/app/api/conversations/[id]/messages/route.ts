import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertOrigin, AppError, errorResponse, route } from '@/lib/errors';
import { admitTurn, attend } from '@/agent/attend';
import { authorizeConversation, transferConversation } from '@/services/conversations';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireUser();
    const { id } = await context.params;
    const input = z
      .object({
        text: z.string().trim().min(1).max(4000),
        requestKey: z.uuid(),
        action: z.enum(['STATUS', 'TICKET', 'HANDOFF']).optional(),
        ticketId: z.string().max(100).optional(),
      })
      .parse(await request.json());
    if (actor.role === 'ANALYST') {
      const conversation = await authorizeConversation(id, actor);
      if (conversation.state !== 'HUMAN' || conversation.assignedToId !== actor.id)
        throw new AppError(409, 'Assuma o atendimento para responder.');
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.conversation.findUnique({ where: { id } });
        if (current?.state !== 'HUMAN' || current.assignedToId !== actor.id)
          throw new AppError(409, 'O responsável pela conversa mudou.');
        await tx.message.upsert({
          where: {
            conversationId_requestKey: { conversationId: id, requestKey: input.requestKey },
          },
          create: {
            conversationId: id,
            requestKey: input.requestKey,
            role: 'ANALYST',
            content: input.text,
          },
          update: {},
        });
        await tx.conversation.update({ where: { id }, data: { version: { increment: 1 } } });
      });
      return Response.json({ ok: true });
    }
    const admission = await admitTurn(id, actor, input);
    if (input.action === 'HANDOFF' && !admission.replay) {
      const conversation = await authorizeConversation(id, actor);
      const history = await db.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
      if (conversation.state === 'AGENT')
        await transferConversation(
          id,
          'Pedido do funcionário',
          history
            .reverse()
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')
            .slice(-5000),
        );
    }
    if (!admission.runId || admission.replay)
      return Response.json({ ok: true, replay: admission.replay });
    const encoder = new TextEncoder();
    let disconnected = false;
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: string, value: unknown) => {
          if (!disconnected) {
            try {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`),
              );
            } catch {
              disconnected = true;
            }
          }
        };
        emit('accepted', { messageId: admission.messageId });
        try {
          await attend(id, actor, input, admission.runId!, emit);
        } catch (error) {
          const response = errorResponse(error);
          const payload = await response.json();
          emit('error', payload);
        } finally {
          if (!disconnected) {
            try {
              controller.close();
            } catch {
              /* disconnected */
            }
          }
        }
      },
      cancel() {
        disconnected = true;
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });
}
