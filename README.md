# StreamOS

Plataforma independente de monetização e experiências interativas para criadores.

## Requisitos

- Node.js 24 (a versão usada está em `.node-version`).
- Corepack, incluído na instalação atual do Node.
- Docker Desktop com Compose, necessário a partir da etapa de infraestrutura.

## Preparação

No PowerShell:

```powershell
corepack prepare pnpm@10.15.0 --activate
corepack pnpm install
Copy-Item .env.example .env
$env:PATH = "$PWD\tools;$env:PATH"
```

Em algumas instalações do Windows, o Corepack não cria imediatamente o atalho `pnpm` no `PATH`. Nesse caso, use `corepack pnpm` no lugar de `pnpm` nos comandos abaixo.

O Turborepo também precisa localizar um executável chamado `pnpm`. Para a sessão atual do PowerShell, adicione o wrapper do projeto ao `PATH`:

```powershell
$env:PATH = "$PWD\tools;$env:PATH"
```

## Desenvolvimento

O modo recomendado no Windows inicia Docker Desktop quando necessário, compila
as aplicações, aguarda todos os health checks e desfaz os processos novos se
algum serviço obrigatório falhar:

```powershell
corepack pnpm local:start
corepack pnpm local:status
```

Depois de uma compilação já validada, `corepack pnpm local:start:fast` apenas
inicia e verifica os serviços. Para encerrar, use `corepack pnpm local:stop`; a
variante `local:stop:all` também encerra PostgreSQL, Redis e Mailpit.

O modo com hot reload continua disponível para desenvolvimento isolado:

```powershell
docker compose up -d --wait
corepack pnpm dev
```

O Mailpit fica disponível em http://localhost:8025. API, realtime, web e overlay
expõem `/health/live`; a API também expõe `/health/ready`, que verifica
PostgreSQL e Redis.

Na primeira execução após instalar Docker Desktop e WSL, o Windows precisa ser reiniciado. Depois do reinício:

```powershell
docker compose up -d --wait
corepack pnpm db:deploy
corepack pnpm db:seed
corepack pnpm dev
```

Serviços previstos:

| Aplicação  | Endereço              |
| ---------- | --------------------- |
| Painel web | http://localhost:3000 |
| API        | http://localhost:3001 |
| Realtime   | ws://localhost:3002   |
| Overlay    | http://localhost:3003 |

## Qualidade

```powershell
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm format:check
```

Para validar a jornada vertical completa, mantenha `api`, `worker` e `realtime`
ativos e execute:

```powershell
corepack pnpm test:e2e:local
```

Esse teste cria uma conta sandbox descartável e valida cadastro, organização,
pagamento mock, webhook, ledger, outbox, alerta com ACK, saldo, saque e
conciliação. Integrações financeiras externas ficam atrás da interface
`PaymentProvider`; o ambiente local usa somente `MockPaymentProvider`.

O seed também cria o operador local `support@streamos.local`. A senha vem de
`SEED_SUPPORT_PASSWORD` e nunca deve ser reutilizada fora do ambiente local.

## Documentos

- [Roadmap](./ROADMAP.md)
- [Plano de implementação local](./IMPLEMENTATION_PLAN.md)
- [Comparação dos PDFs com o roadmap](./docs/ROADMAP-COMPARATIVO.md)
- [Documentação consolidada do produto](./docs/product/)
- [Projeto completo v3](./docs/product/StreamOS-Projeto-Completo-v3.pdf)
- [Projeto estratégico v2 revisado](./docs/product/StreamOS-Projeto-Estrategico-v2-revisado.pdf)
- [Produto e features ilustrado](./docs/product/StreamOS-Produto-e-Features-Ilustrado.pdf)
