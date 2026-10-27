# Validação da entrega

Verificações executadas em 27 de outubro de 2026:

| Verificação | Resultado |
| --- | --- |
| TypeScript estrito | Passou |
| Regras de prioridade, SLA, duplicidade e busca de artigos | 19 testes passaram |
| PostgreSQL, confirmação concorrente, revisão de rascunhos e transferência durante processamento | 9 testes passaram |
| Playwright: desktop/mobile, edição e confirmação, limite de sessão e conversa entre funcionário/analista | 3 testes passaram |
| Recuperação real de senha com entrega no Mailpit | Passou: expiração, uso único, troca de senha e revogação de sessão |
| Build Next.js de produção | Passou localmente em Docker e na CI |
| Build da imagem Docker final no Linux | Passou na CI |
| Groq / GPT-OSS 120B: classificação estruturada | 12 de 12 cenários passaram com o modelo real |
| Groq pela API da aplicação | Passou: login, classificação, resposta em streaming, persistência e rastreio |

[Execução completa aprovada no GitHub Actions](https://github.com/verickmr/nexo-ts/actions/runs/40561967238). Essa execução validou o comportamento funcional; os ajustes posteriores de tipografia e formatação foram conferidos novamente com TypeScript e Playwright.

Os testes locais atuais utilizaram uma instância isolada de PostgreSQL 16 no Windows, após o WSL deixar de responder durante falta de espaço em disco. A primeira validação também executou PostgreSQL 17 no Docker. A CI usa Linux e PostgreSQL 17; os resultados completos ficam na aba Actions do repositório.

As capturas em `docs/screenshots` foram obtidas da aplicação em execução, nas dimensões desktop do protótipo e em 390 × 844 para mobile. A faixa de respostas roteirizadas identifica o modo offline usado nos testes.

## Avaliação com IA real

O [relatório de classificação](evaluation-latest.json) registra as entradas, saídas tipadas e latências de 12 cenários executados com `groq/openai/gpt-oss-120b`: dúvidas, consulta, transferência, assuntos fora do escopo, requisições, incidentes com diferentes impactos e urgências, atualização e tentativa de acesso a chamados de outra pessoa. Todos passaram nas expectativas de intenção e campos rotulados. Esse conjunto pequeno não mede acurácia geral nem substitui os testes de autorização do servidor.

Uma verificação adicional pela API HTTP da aplicação autenticou um funcionário fictício, criou uma conversa e enviou “Que horas o suporte atende?”. A primeira execução revelou uma falha de recuperação: a busca só considerava títulos e palavras-chave e aceitava fragmentos de palavras. A correção passou a buscar palavras completas também no corpo dos artigos, com maior peso para títulos e palavras-chave, ignorando termos comuns. Três testes de regressão cobrem esse caso e a aplicabilidade por sistema operacional.

Após a correção, a execução real em streaming respondeu com o horário de segunda a sexta, das 8h às 18h, conforme a fonte. A resposta e a decisão foram persistidas, sem criar chamado. O [registro dessa verificação](groq-smoke.json) contém somente dados fictícios e o resultado público da resposta. A chave permaneceu no `.env` ignorado pelo Git.

## Dependências de configuração

- Para repetir a avaliação do LLM real, configure uma chave Groq em `GROQ_API_KEY` e `AI_MODE=groq`.
- O projeto de hospedagem `nexo-assist` foi criado na Vercel. A integração Neon depende do aceite dos termos no navegador da conta; a publicação funcional depende do banco configurado.
- O modo real de autenticação funciona com SMTP configurado. No ambiente demonstrativo, o login continua aceitando qualquer senha, como exige o PRD.

Nenhuma chave de IA, senha de banco de produção, token de sessão ou arquivo `.env` é entregue no repositório.
