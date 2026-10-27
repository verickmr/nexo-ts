import { afterAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { transferConversation } from '@/services/conversations';
import { admitTurn, attend } from '@/agent/attend';
const gate = vi.hoisted(() => {
  let enteredResolve!: () => void;
  let releaseResolve!: () => void;
  const entered = new Promise<void>((resolve) => {
    enteredResolve = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseResolve = resolve;
  });
  return { entered, released, enter: () => enteredResolve(), release: () => releaseResolve() };
});
vi.mock('@/agent/mastra', () => ({
  decide: async () => {
    gate.enter();
    await gate.released;
    return {
      intent: 'CREATE',
      confidence: 0.95,
      reason: 'Resposta atrasada simulada.',
      ticketId: null,
      title: 'Notebook de laboratório não liga',
      description: 'Notebook não liga após o diagnóstico inicial.',
      type: 'INC',
      category: 'HARDWARE',
      impact: 'PERSON',
      urgency: 'BLOCKED',
      articleIds: [],
      question: null,
      options: [],
    };
  },
  streamAnswer: vi.fn(),
}));
const ownerId = `race-${randomUUID()}`;
afterAll(async () => {
  gate.release();
  await db.conversation.deleteMany({ where: { ownerId } });
  await db.usage.deleteMany({ where: { key: { contains: ownerId } } });
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});
it('uma resposta de IA atrasada não cria rascunho nem publica após transferência', async () => {
  const actor = await db.user.create({
    data: {
      id: ownerId,
      name: 'Teste de corrida',
      email: `${ownerId}@example.test`,
      department: 'Testes',
    },
  });
  const conversation = await db.conversation.create({ data: { ownerId } });
  const input = { text: 'O notebook não liga, preciso de ajuda.', requestKey: randomUUID() };
  const admission = await admitTurn(conversation.id, actor, input);
  const turn = attend(conversation.id, actor, input, admission.runId!, () => {});
  const rejectedTurn = expect(turn).rejects.toMatchObject({ status: 409 });
  await gate.entered;
  await transferConversation(
    conversation.id,
    'Pedido do funcionário',
    'Quero falar com uma pessoa.',
  );
  gate.release();
  await rejectedTurn;
  expect(await db.draft.count({ where: { conversationId: conversation.id } })).toBe(0);
  expect(
    await db.message.count({ where: { conversationId: conversation.id, role: 'ASSISTANT' } }),
  ).toBe(0);
  expect((await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).state).toBe(
    'WAITING_ANALYST',
  );
});
