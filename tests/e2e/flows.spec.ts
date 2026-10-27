import 'dotenv/config';
import { expect, test, type Page } from '@playwright/test';
import { db } from '../../src/lib/db';
import fs from 'node:fs';
const created: string[] = [];
async function login(page: Page, email = 'ana.souza@nexo.com.br') {
  await page.goto('/entrar');
  await page.getByLabel('E-mail corporativo').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('qualquer-senha');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/atendimento|analista/);
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true });
}
test.afterAll(async () => {
  const drafts = await db.draft.findMany({ where: { conversationId: { in: created } } });
  const ticketIds = drafts.map((d) => d.resultTicketId).filter((id): id is string => !!id);
  await db.conversation.deleteMany({ where: { id: { in: created } } });
  await db.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await db.$disconnect();
});
test('telas do protótipo, transparência e perfil em desktop e celular', async ({ page }) => {
  await page.goto('/entrar');
  await shot(page, 'login');
  await login(page);
  await expect(
    page.getByRole('heading', { name: 'VPN não conecta no notebook — erro 809' }),
  ).toBeVisible();
  await shot(page, 'chat');
  await page.getByText('Ver decisão', { exact: false }).first().click();
  await expect(
    page.getByText('Confiança estimada; não é uma probabilidade calibrada.').first(),
  ).toBeVisible();
  await shot(page, 'decisao');
  await page.getByRole('link', { name: 'Meu perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil', exact: true })).toBeVisible();
  await shot(page, 'perfil');
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page.getByRole('status')).toContainText('demonstração');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/atendimento');
  await expect(
    page.getByRole('heading', { name: 'VPN não conecta no notebook — erro 809' }),
  ).toBeVisible();
  await shot(page, 'chat-mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('rascunho editável, confirmação idempotente, persistência e limite de sessão', async ({
  page,
}) => {
  await login(page, 'fabio.nunes@nexo.com.br');
  await page.getByRole('button', { name: 'Nova conversa', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Como posso ajudar/ })).toBeVisible();
  const response = await page.request.get('/api/conversations');
  const list = await response.json();
  const id = list[0].id as string;
  created.push(id);
  await page
    .getByLabel('Mensagem para o Nexo Assist')
    .fill('Meu notebook não liga. Não consigo trabalhar.');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByText('Quem está sendo afetado?', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '1 Só eu' }).last().click();
  await expect(page.getByText('Aguardando confirmação', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Notebook de teste automatizado não liga');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Criei o chamado', { exact: false })).toBeVisible();
  const before = await (await page.request.get(`/api/conversations/${id}`)).json();
  const draft = before.drafts.find((d: { status: string }) => d.status === 'CONFIRMED');
  const duplicate = await page.request.post(`/api/drafts/${draft.id}`, {
    data: { action: 'CONFIRM', version: draft.version },
  });
  expect(duplicate.status()).toBe(200);
  const after = await (await page.request.get(`/api/conversations/${id}`)).json();
  expect(after.tickets.length).toBe(before.tickets.length);
  await page.reload();
  await expect(page.getByText('Criei o chamado', { exact: false })).toBeVisible();
  await db.conversation.update({ where: { id }, data: { messageCount: 30 } });
  await page.goto('/atendimento');
  // Select our conversation because the initial demo chooses the newest history for this employee.
  await expect(page.getByText('Limite da sessão atingido.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Falar com um analista', exact: true }).last().click();
  await expect(page.getByText('Aguardando um analista.', { exact: false })).toBeVisible();
});
test('funcionário e analista conversam com o agent pausado, devolvem e encerram', async ({
  browser,
}) => {
  const employeeContext = await browser.newContext();
  const analystContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  const analyst = await analystContext.newPage();
  await login(employee, 'carla.mendes@nexo.com.br');
  await employee.getByRole('button', { name: 'Nova conversa', exact: true }).click();
  const snapshot = await (await employee.request.get('/api/conversations')).json();
  const id = snapshot[0].id as string;
  created.push(id);
  await employee.getByRole('button', { name: /Falar com um analista Encaminhe/ }).click();
  await expect(employee.getByText('Aguardando um analista.', { exact: false })).toBeVisible();
  await login(analyst, 'rafael.lima@nexo.com.br');
  await analyst.getByLabel('Pesquisar conversa ou chamado').fill('Quero falar com um analista');
  await analyst.getByRole('button').filter({ hasText: 'Carla Mendes' }).first().click();
  await expect(
    analyst.getByRole('button', { name: 'Assumir atendimento', exact: true }),
  ).toBeVisible();
  await shot(analyst, 'console-transferido');
  await analyst.getByRole('button', { name: 'Assumir atendimento', exact: true }).click();
  await analyst
    .getByLabel('Mensagem do analista')
    .fill('Olá, Carla. Já li seu histórico e vou ajudar.');
  await analyst.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(employee.getByText('Olá, Carla. Já li seu histórico e vou ajudar.')).toBeVisible();
  await employee
    .getByLabel('Mensagem para o Nexo Assist')
    .fill('Obrigada, estou com o notebook ligado.');
  await employee.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(
    analyst.getByRole('main').getByText('Obrigada, estou com o notebook ligado.'),
  ).toBeVisible();
  await shot(analyst, 'console-assumido');
  const current = await (await employee.request.get(`/api/conversations/${id}`)).json();
  expect(current.messages.filter((m: { role: string }) => m.role === 'ASSISTANT')).toHaveLength(0);
  await analyst.getByRole('button', { name: 'Devolver ao agent', exact: true }).click();
  await expect(employee.getByText('Assistente online', { exact: true })).toBeVisible();
  await analyst.getByRole('button', { name: 'Assumir atendimento', exact: true }).click();
  await analyst.getByRole('button', { name: 'Encerrar atendimento', exact: true }).click();
  await expect(employee.getByText('Atendimento encerrado.', { exact: false })).toBeVisible();
  const privateResponse = await employee.request.get('/api/conversations/exemplo-vpn');
  expect(privateResponse.status()).toBe(404);
  await employeeContext.close();
  await analystContext.close();
});
