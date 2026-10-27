import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/auth';
import { dueDate } from '../src/domain/sla';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }) });
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000);
async function main() {
  const real = process.env.AUTH_MODE === 'password';
  if (real && (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12)) throw new Error('Defina SEED_PASSWORD com ao menos 12 caracteres para o modo password.');
  const passwordHash = process.env.SEED_PASSWORD ? await hashPassword(process.env.SEED_PASSWORD) : null;
  const people = [
    { id: 'ana', name: 'Ana Souza', email: 'ana.souza@nexo.com.br', department: 'Financeiro' },
    { id: 'carla', name: 'Carla Mendes', email: 'carla.mendes@nexo.com.br', department: 'Comercial' },
    { id: 'bruno', name: 'Bruno Tavares', email: 'bruno.tavares@nexo.com.br', department: 'Operações' },
    { id: 'diego', name: 'Diego Ramos', email: 'diego.ramos@nexo.com.br', department: 'Marketing', os: 'Windows 10' },
    { id: 'elisa', name: 'Elisa Prado', email: 'elisa.prado@nexo.com.br', department: 'Produto' },
    { id: 'fabio', name: 'Fábio Nunes', email: 'fabio.nunes@nexo.com.br', department: 'Pessoas' },
    { id: 'gabriela', name: 'Gabriela Rocha', email: 'gabriela.rocha@nexo.com.br', department: 'Jurídico' },
    { id: 'rafael', name: 'Rafael Lima', email: 'rafael.lima@nexo.com.br', department: 'TI', role: 'ANALYST' as const, team: 'Suporte N2' },
    { id: 'marina', name: 'Marina Costa', email: 'marina.costa@nexo.com.br', department: 'TI', role: 'ANALYST' as const, team: 'Suporte N1' }
  ];
  for (const person of people) await db.user.upsert({ where: { id: person.id }, create: { ...person, passwordHash, passwordChangedAt: passwordHash ? new Date() : null }, update: {} });
  const articles = [
    { id: 'vpn809', title: 'VPN com erro 809 no Windows 10', body: 'No Windows 10, reinstale o cliente de VPN pelo portal de softwares da Nexo e reinicie o computador. Esta orientação vale apenas para Windows 10. No Windows 11, abra um chamado para a equipe de Rede e VPN.', keywords: ['vpn', '809', 'conexão', 'rede'], applicableOs: ['Windows 10'] },
    { id: 'horario', title: 'Horário do service desk e plantão', body: 'O service desk atende de segunda a sexta, das 8h às 18h, no horário de São Paulo. Chamados críticos têm plantão 24 horas. O SLA é de primeira resposta e de cada atualização, não uma promessa de resolução.', keywords: ['horário', 'atendimento', 'plantão', 'sla', 'prazo'], applicableOs: [] },
    { id: 'senha', title: 'Redefinir a senha da rede', body: 'Para redefinir a senha, acesse o portal corporativo, escolha “Esqueci minha senha” e siga a verificação de identidade. Nunca envie sua senha pelo chat. Se não conseguir acessar o portal, peça um analista.', keywords: ['senha', 'redefinir', 'bloqueada', 'rede'], applicableOs: [] },
    { id: 'wifi', title: 'Conectar ao Wi-Fi corporativo', body: 'Selecione a rede Nexo-Corporativo e use seu e-mail corporativo no campo de usuário. Confira se o Wi-Fi e o adaptador de rede estão ativados. Se o erro continuar, informe a mensagem exibida, o local e o sistema operacional.', keywords: ['wifi', 'wi-fi', 'internet', 'rede'], applicableOs: [] },
    { id: 'outlook', title: 'Outlook não sincroniza', body: 'Confira a conexão com a internet e se o Outlook está no modo “Trabalhar Offline”. Desative esse modo e reinicie o aplicativo. Se persistir, informe quando começou e se o webmail funciona; não envie sua senha.', keywords: ['outlook', 'email', 'e-mail', 'sincroniza'], applicableOs: [] },
    { id: 'monitor', title: 'Solicitar monitor e periféricos', body: 'Monitor, teclado e mouse são solicitações de equipamento. Informe o item necessário, a justificativa e quem será atendido. Pedidos sem urgência têm prioridade baixa e prazo de resposta de cinco dias úteis.', keywords: ['monitor', 'mouse', 'teclado', 'equipamento', 'periférico'], applicableOs: [] },
    { id: 'software', title: 'Instalar software aprovado', body: 'Abra o portal de softwares da Nexo e procure o aplicativo aprovado. Instale apenas por esse canal. Para um software que não está no portal, solicite avaliação da TI e descreva a necessidade de uso.', keywords: ['software', 'instalar', 'programa', 'aplicativo'], applicableOs: [] },
    { id: 'notebook', title: 'Notebook lento: diagnóstico inicial', body: 'Salve seus arquivos e reinicie o notebook. Confira o espaço livre em disco e feche aplicativos que não estão sendo usados. Se continuar lento, informe quando começou, o sistema operacional e o impacto no trabalho.', keywords: ['notebook', 'computador', 'lento', 'lentidão', 'hardware'], applicableOs: [] }
  ];
  for (const article of articles) await db.article.upsert({ where: { id: article.id }, create: article, update: article });
  const seeds = [
    { id: 'ticket-notebook', number: 'INC-20311', ownerId: 'ana', title: 'Notebook lento após atualização do Windows', description: 'Lentidão geral desde a última atualização. Reiniciar e rodar o diagnóstico da central não resolveu.', type: 'INC' as const, category: 'HARDWARE' as const, priority: 'MEDIUM' as const, status: 'WAITING' as const, lastServiceUpdateAt: daysAgo(6), dueAt: daysAgo(2), createdAt: daysAgo(8) },
    { id: 'ticket-pasta', number: 'INC-20298', ownerId: 'ana', title: 'Acesso à pasta Financeiro no SharePoint', description: 'Acesso negado na pasta compartilhada da equipe Financeiro. O acesso pelo navegador também falhou.', type: 'INC' as const, category: 'ACCESS' as const, priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, lastServiceUpdateAt: new Date(), dueAt: dueDate('HIGH'), createdAt: daysAgo(2) },
    { id: 'ticket-monitor', number: 'REQ-10442', ownerId: 'ana', title: 'Segundo monitor para home office', description: 'Solicitação de segundo monitor para conciliação de planilhas financeiras. Sem urgência.', type: 'REQ' as const, category: 'HARDWARE' as const, priority: 'LOW' as const, status: 'APPROVED' as const, lastServiceUpdateAt: new Date(), dueAt: dueDate('LOW'), createdAt: daysAgo(7) },
    { id: 'ticket-sap', number: 'INC-20150', ownerId: 'ana', title: 'Senha do SAP bloqueada', description: 'Usuária não conseguia entrar no SAP. Acesso restabelecido pelo suporte.', type: 'INC' as const, category: 'ACCESS' as const, priority: 'MEDIUM' as const, status: 'RESOLVED' as const, resolvedAt: daysAgo(4), lastServiceUpdateAt: daysAgo(4), dueAt: daysAgo(3), createdAt: daysAgo(5) },
    { id: 'ticket-antigo', number: 'INC-19877', ownerId: 'ana', title: 'Outlook não sincroniza no celular', description: 'Perfil do Outlook reconfigurado; sincronização normalizada.', type: 'INC' as const, category: 'EMAIL' as const, priority: 'MEDIUM' as const, status: 'RESOLVED' as const, resolvedAt: daysAgo(35), lastServiceUpdateAt: daysAgo(35), dueAt: daysAgo(34), createdAt: daysAgo(40) },
    { id: 'ticket-carla', number: 'INC-20519', ownerId: 'carla', title: 'Acesso ao SAP bloqueado', description: 'Preciso acessar o SAP para concluir o pedido de um cliente hoje.', type: 'INC' as const, category: 'ACCESS' as const, priority: 'HIGH' as const, status: 'OPEN' as const, lastServiceUpdateAt: new Date(), dueAt: dueDate('HIGH'), createdAt: new Date() },
    { id: 'ticket-bruno', number: 'INC-20520', ownerId: 'bruno', title: 'Integração do sistema de estoque intermitente', description: 'Falha intermitente cuja origem ainda não está identificada. Requer diagnóstico de especialista.', type: 'INC' as const, category: 'SOFTWARE' as const, priority: 'MEDIUM' as const, status: 'WAITING' as const, lastServiceUpdateAt: new Date(), dueAt: dueDate('MEDIUM'), createdAt: new Date() }
  ];
  for (const ticket of seeds) await db.ticket.upsert({ where: { id: ticket.id }, create: { ...ticket, impact: 'PERSON', urgency: ticket.priority === 'HIGH' ? 'TODAY' : ticket.priority === 'LOW' ? 'NO_RUSH' : 'WORKAROUND', updates: { create: { author: 'Service desk', content: ticket.description, createdAt: ticket.lastServiceUpdateAt } } }, update: {} });
  await db.counter.upsert({ where: { key: 'INC' }, create: { key: 'INC', value: 20520 }, update: {} });
  await db.counter.upsert({ where: { key: 'REQ' }, create: { key: 'REQ', value: 10450 }, update: {} });
  const demoConversation = await db.conversation.findUnique({ where: { id: 'exemplo-vpn' } });
  if (!demoConversation) {
    const data = { title: 'VPN não conecta no notebook — erro 809', description: 'Desde ontem, o notebook com Windows 11 não conecta à VPN e mostra o erro 809. Ana tem reunião com um cliente hoje às 14h e precisa da VPN.', type: 'INC', category: 'NETWORK', impact: 'PERSON', urgency: 'TODAY', priority: 'HIGH', dueAt: dueDate('HIGH').toISOString() };
    await db.conversation.create({ data: { id: 'exemplo-vpn', ownerId: 'ana', title: 'VPN não conecta · erro 809', messageCount: 2, context: { intent: 'CREATE', ...data, confidence: 0.96, reason: 'Exemplo de coleta de informações do protótipo.', ticketId: null, articleIds: [], question: null, options: [] } } });
    const draft = await db.draft.create({ data: { id: 'rascunho-vpn', conversationId: 'exemplo-vpn', operation: 'CREATE', data } });
    const messages = [
      { role: 'USER' as const, content: 'Meu notebook não conecta na VPN desde ontem. Aparece o erro 809.', metadata: {} },
      { role: 'ASSISTANT' as const, content: 'Não há chamado aberto sobre VPN, e o artigo do erro 809 vale só para Windows 10 — o seu é Windows 11. Quem está sendo afetado?', metadata: { options: ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'], trace: { intent: 'CREATE', confidence: 0.96, reason: 'Histórico de exemplo: artigo incompatível com o sistema operacional.', rules: ['Aplicabilidade do artigo'], actions: [{ label: 'consultou seus chamados', result: 'Sem chamado de VPN', success: true, durationMs: 18 }, { label: 'buscou na central de ajuda', result: 'Artigo de VPN válido apenas no Windows 10', success: true, durationMs: 12 }], sources: [{ id: 'vpn809', title: 'VPN com erro 809 no Windows 10' }], durationMs: 30, model: 'histórico demonstrativo do protótipo', tokens: 0 } } },
      { role: 'USER' as const, content: 'Só eu. Tenho reunião com um cliente às 14h e preciso da VPN funcionando.', metadata: {} },
      { role: 'ASSISTANT' as const, content: 'Coloquei prioridade alta porque há um compromisso hoje. O prazo é de 4 horas úteis para resposta; ele não garante resolução antes da reunião. Confira antes de eu criar:', metadata: { draftId: draft.id, trace: { intent: 'CREATE', confidence: 0.98, reason: 'Histórico de exemplo: uma pessoa afetada e compromisso no mesmo dia.', rules: ['Prioridade alta para compromisso hoje', 'Confirmação antes de criar'], actions: [{ label: 'classificou a prioridade', result: 'Alta', success: true, durationMs: 1 }, { label: 'consultou o SLA', result: '4 horas úteis', success: true, durationMs: 1 }, { label: 'montou o rascunho', result: draft.id, success: true, durationMs: 4 }], sources: [], durationMs: 6, model: 'histórico demonstrativo do protótipo', tokens: 0 } } }
    ];
    for (let i = 0; i < messages.length; i++) await db.message.create({ data: { ...messages[i], conversationId: 'exemplo-vpn', createdAt: new Date(Date.now() - (messages.length - i) * 60000) } });
  }
  for (const [ownerId, id, title, reason, last] of [
    ['ana', 'exemplo-transferido', 'Notebook lento após atualização', 'Chamado com SLA vencido', 'Quero falar com um analista.'],
    ['carla', 'exemplo-carla', 'Acesso ao SAP', 'Pedido do funcionário', 'Preciso de acesso ao SAP ainda hoje.'],
    ['bruno', 'exemplo-bruno', 'Sistema de estoque', 'Baixa confiança na decisão', 'A integração funciona de vez em quando.'],
    ['diego', 'exemplo-diego', 'Configuração de Wi-Fi', '', 'Como conecto no Wi-Fi corporativo?'],
    ['elisa', 'exemplo-elisa', 'Solicitação de software', '', 'Preciso instalar um programa de design.'],
    ['fabio', 'exemplo-fabio', 'Dúvida resolvida', '', 'Isso resolveu, obrigado!'],
    ['gabriela', 'exemplo-gabriela', 'Horário de atendimento', '', 'Qual é o horário do suporte?']
  ]) {
    if (!await db.conversation.findUnique({ where: { id } })) {
      await db.conversation.create({ data: { id, ownerId, title, state: reason ? 'WAITING_ANALYST' : ownerId === 'fabio' ? 'CLOSED' : 'AGENT', handoffReason: reason || null, handoffSummary: reason ? `${title}. ${last}` : null, handoffTeam: reason ? 'Suporte N2' : null, handedOffAt: reason ? new Date() : null, messages: { create: [{ role: 'USER', content: last, createdAt: new Date(Date.now() - 60000) }, ...(reason ? [{ role: 'SYSTEM' as const, content: `Transferida para Suporte N2. Agent pausado. Motivo: ${reason}` }] : [])] } } });
    }
  }
  console.log('Seed concluído: 9 usuários fictícios, 8 artigos, 7 chamados e históricos demonstrativos. Dados existentes preservados.');
}
main().finally(() => db.$disconnect());
