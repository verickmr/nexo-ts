import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { confirmDraft } from '@/services/drafts';
import { authorizeConversation, transferConversation } from '@/services/conversations';
import { admitTurn } from '@/agent/attend';
import { hashPassword, verifyPassword } from '@/lib/auth';
import type { User } from '@/generated/prisma/client';
const id = `test-${randomUUID()}`;
let actor: User; let other: User;
const data = { title: 'VPN de laboratório indisponível', description: 'Cliente de VPN não conecta nesta máquina de teste.', type: 'INC', category: 'NETWORK', impact: 'PERSON', urgency: 'WORKAROUND' };
beforeAll(async () => {
  actor = await db.user.create({ data: { id, name: 'Teste isolado', email: `${id}@example.test`, department: 'Testes' } });
  other = await db.user.create({ data: { id: `${id}-other`, name: 'Outro teste', email: `${id}-other@example.test`, department: 'Testes' } });
});
afterAll(async () => {
  const owners = [id, `${id}-other`];
  await db.conversation.deleteMany({ where: { ownerId: { in: owners } } });
  await db.ticket.deleteMany({ where: { ownerId: { in: owners } } });
  await db.user.deleteMany({ where: { id: { in: owners } } });
  await db.usage.deleteMany({ where: { key: { contains: id } } });
  await db.$disconnect();
});
describe('Gravações e autorização no PostgreSQL real', () => {
  it('protege conversas contra acesso por outro funcionário', async () => {
    const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
    await expect(authorizeConversation(conversation.id, other)).rejects.toMatchObject({ status: 404 });
  });
  it('confirmações concorrentes criam apenas um chamado e repetem o mesmo resultado', async () => {
    const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
    const draft = await db.draft.create({ data: { conversationId: conversation.id, operation: 'CREATE', data } });
    const [left, right] = await Promise.all([confirmDraft(draft.id, 0, actor), confirmDraft(draft.id, 0, actor)]);
    expect(left).toHaveProperty('id'); expect(right).toHaveProperty('id', (left as { id: string }).id);
    expect(await db.ticket.count({ where: { ownerId: actor.id } })).toBe(1);
  });
  it('novo duplicado após o rascunho exige outra confirmação e atualiza o mesmo chamado', async () => {
    const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
    const draft = await db.draft.create({ data: { conversationId: conversation.id, operation: 'CREATE', data } });
    expect(await confirmDraft(draft.id, 0, actor)).toEqual({ needsReconfirmation: true });
    const changed = await db.draft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(changed.operation).toBe('UPDATE');
    await expect(confirmDraft(draft.id, 0, actor)).rejects.toMatchObject({ status: 409 });
    const result = await confirmDraft(draft.id, 1, actor); expect(result).toHaveProperty('id');
    expect(await db.ticket.count({ where: { ownerId: actor.id } })).toBe(1);
  });
  it('não confirma rascunho alheio nem grava com o agent pausado', async () => {
    const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
    const draft = await db.draft.create({ data: { conversationId: conversation.id, operation: 'CREATE', data } });
    await expect(confirmDraft(draft.id, 0, other)).rejects.toMatchObject({ status: 404 });
    await transferConversation(conversation.id, 'Teste', 'Resumo');
    await expect(confirmDraft(draft.id, 0, actor)).rejects.toMatchObject({ status: 409 });
  });
  it('preserva atualização concorrente e exige revisão antes de gravar um rascunho antigo', async () => {
    const ticket = await db.ticket.findFirstOrThrow({ where: { ownerId: actor.id, category: 'NETWORK' } });
    const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
    const draft = await db.draft.create({ data: { conversationId: conversation.id, operation: 'UPDATE', ticketId: ticket.id, ticketVersion: ticket.version, data: { ...data, description: 'Complemento informado pelo funcionário depois do diagnóstico.' } } });
    await db.ticket.update({ where: { id: ticket.id }, data: { description: 'Nova informação registrada pelo analista em outra sessão.', version: { increment: 1 } } });
    expect(await confirmDraft(draft.id, 0, actor)).toEqual({ needsReconfirmation: true });
    const revised = await db.draft.findUniqueOrThrow({ where: { id: draft.id } });
    const proposed = revised.data as { description: string };
    expect(proposed.description).toContain('Nova informação registrada pelo analista');
    expect(proposed.description).toContain('Complemento informado pelo funcionário');
    const confirmed = await confirmDraft(draft.id, revised.version, actor);
    expect(confirmed).toHaveProperty('description', proposed.description);
  });
  it('mensagens repetidas são idempotentes e o limite não bloqueia transferência', async () => {
    const conversation = await db.conversation.create({ data: { ownerId: actor.id, messageCount: 29 } });
    const input = { text: 'Uma mensagem de teste', requestKey: randomUUID() };
    const first = await admitTurn(conversation.id, actor, input); const repeated = await admitTurn(conversation.id, actor, input);
    expect(first.replay).toBe(false); expect(repeated.replay).toBe(true);
    await expect(admitTurn(conversation.id, actor, { ...input, requestKey: randomUUID() })).rejects.toMatchObject({ code: 'SESSION_LIMIT' });
    await expect(admitTurn(conversation.id, actor, { ...input, requestKey: randomUUID(), action: 'HANDOFF' })).resolves.toHaveProperty('runId', null);
    const saved = await db.conversation.findUniqueOrThrow({ where: { id: conversation.id } }); expect(saved.messageCount).toBe(30);
  });
  it('indisponibilidade do legado não cria chamado e libera nova tentativa', async () => {
    const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
    const draft = await db.draft.create({ data: { conversationId: conversation.id, operation: 'CREATE', data: { ...data, title: 'Mouse USB de teste quebrado', category: 'HARDWARE' } } });
    process.env.LEGACY_FAILURE_RATE = '1';
    try { await expect(confirmDraft(draft.id, 0, actor)).rejects.toMatchObject({ code: 'LEGACY_UNAVAILABLE' }); } finally { process.env.LEGACY_FAILURE_RATE = '0'; }
    expect((await db.draft.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('PENDING');
    await expect(confirmDraft(draft.id, 0, actor)).resolves.toHaveProperty('number');
  });
});
it('hash de senha tem salt e valida a credencial sem armazenar o segredo', async () => {
  const first = await hashPassword('UmaSenhaDeTeste-2026'); const second = await hashPassword('UmaSenhaDeTeste-2026');
  expect(first).not.toBe(second); expect(first).not.toContain('UmaSenha');
  expect(await verifyPassword('UmaSenhaDeTeste-2026', first)).toBe(true); expect(await verifyPassword('errada', first)).toBe(false);
});
