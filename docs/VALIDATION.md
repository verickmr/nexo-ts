# Validação da entrega

Verificações executadas em 27 de outubro de 2026:

| Verificação | Resultado |
| --- | --- |
| TypeScript estrito | Passou |
| Regras de prioridade, SLA e duplicidade | 16 testes passaram |
| PostgreSQL, confirmação concorrente, revisão de rascunhos e transferência durante processamento | 9 testes passaram |
| Playwright: desktop/mobile, edição e confirmação, limite de sessão e conversa entre funcionário/analista | 3 testes passaram |
| Recuperação real de senha com entrega no Mailpit | Passou: expiração, uso único, troca de senha e revogação de sessão |
| Build Next.js de produção | Passou localmente em Docker e na CI |
| Build da imagem Docker final no Linux | Passou na CI |

[Execução completa aprovada no GitHub Actions](https://github.com/verickmr/nexo-ts/actions/runs/40561967238). Essa execução validou o comportamento funcional; os ajustes posteriores de tipografia e formatação foram conferidos novamente com TypeScript e Playwright.

Os testes locais atuais utilizaram uma instância isolada de PostgreSQL 16 no Windows, após o WSL deixar de responder durante falta de espaço em disco. A primeira validação também executou PostgreSQL 17 no Docker. A CI usa Linux e PostgreSQL 17; os resultados completos ficam na aba Actions do repositório.

As capturas em `docs/screenshots` foram obtidas da aplicação em execução, nas dimensões desktop do protótipo e em 390 × 844 para mobile. A faixa de respostas roteirizadas identifica o modo offline usado nos testes.

## Dependências de configuração

- A avaliação do LLM real exige uma chave Groq em `GROQ_API_KEY` e `AI_MODE=groq`. Não foi executada com uma chave do usuário nesta validação.
- O projeto de hospedagem `nexo-assist` foi criado na Vercel. A integração Neon depende do aceite dos termos no navegador da conta; a publicação funcional depende do banco configurado.
- O modo real de autenticação funciona com SMTP configurado. No ambiente demonstrativo, o login continua aceitando qualquer senha, como exige o PRD.

Nenhuma chave de IA, senha de banco de produção, token de sessão ou arquivo `.env` é entregue no repositório.
