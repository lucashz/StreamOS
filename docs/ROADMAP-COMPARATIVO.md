# StreamOS — Comparação dos PDFs com o roadmap

Data da análise: 16 de agosto de 2026

## Fontes comparadas

Foram lidos e comparados os seis PDFs encontrados em `streamos-v2`:

1. `StreamOS-Projeto-Completo-v3.pdf`
2. `StreamOS-Projeto-Estrategico-v2-revisado.pdf`
3. `StreamOS-Planejamento-e-Infraestrutura.pdf`
4. `StreamOS-Produto-e-Features-Ilustrado.pdf`
5. `StreamOS-Produto-e-Features.pdf`
6. `StreamOS-Projeto-Estrategico-v2.pdf`

Em caso de divergência, a ordem acima define a precedência. O documento completo V3 é a referência mais abrangente; documentos revisados prevalecem sobre versões anteriores.

## Resultado executivo

O roadmap existente estava correto na tese central e na maior parte do escopo funcional. Ele já cobria:

- StreamOS independente da LivePix.
- Parceiro regulado para os trilhos financeiros.
- Ledger de dupla entrada, idempotência, conciliação e outbox.
- Pix, carteira, saque e reservas de risco.
- Checkout, alertas, Browser Source, WebSocket e recuperação de fila.
- Metas, ranking, Boss Battle, TTS, mídia e integrações posteriores.
- IA com guardrails e sem autoridade sobre saldo ou saques.
- Backoffice, auditoria, testes de carga, segurança e recuperação.

O principal déficit não estava no produto, mas na operação em escala. Os PDFs mais recentes incluem metas de serviço, capacidade, estratégia de infraestrutura, FinOps e gates comerciais que ainda não apareciam de forma explícita.

## Matriz de cobertura

| Área                         | PDFs                          | Roadmap anterior | Decisão consolidada                                            |
| ---------------------------- | ----------------------------- | ---------------- | -------------------------------------------------------------- |
| Plataforma independente      | Obrigatória                   | Coberta          | Manter                                                         |
| Parceiro financeiro regulado | Obrigatório                   | Coberto          | Manter adaptador e avaliar contingência                        |
| Ledger e conciliação         | Core do produto               | Coberto          | Manter como domínio isolado                                    |
| Pix, saldo e saque           | MVP financeiro                | Coberto          | Manter antes de escala pública                                 |
| Cartão e chargeback          | Lançamento comercial          | Pós-MVP          | Entrar na fase comercial, não no beta inicial                  |
| Alertas OBS e WebSocket      | Beta de streaming             | Coberto          | Manter P95 abaixo de 2 segundos                                |
| TTS e moderação              | Beta de streaming             | V1               | Antecipar versão limitada para o beta de streaming             |
| Mídia enviada                | Escopo funcional mínimo amplo | Pós-MVP          | Manter após texto/TTS por risco e custo                        |
| Gamificação                  | Retenção                      | Coberta          | Manter depois do núcleo financeiro                             |
| Recorrência                  | Retenção                      | Coberta          | Manter após homologação financeira                             |
| Integrações e app            | V1/V2                         | Cobertos         | Priorizar conforme demanda do beta                             |
| API e marketplace            | Plataforma                    | Cobertos         | Manter V2/V3                                                   |
| SLO, RPO e RTO               | Obrigatórios                  | Parcial          | Adicionar metas mensuráveis                                    |
| Planejamento de capacidade   | Três cenários                 | Ausente          | Adicionar modelo por PPS/EPS e carga viral                     |
| Cloud econômica/híbrida      | Recomendação inicial          | Parcial          | Formalizar evolução por risco, não por preferência de provedor |
| Segundo parceiro financeiro  | Contingência futura           | Ausente          | Adicionar à fase de plataforma                                 |
| FinOps e unidade econômica   | Obrigatórios                  | Ausente          | Adicionar TPV, take rate, margem e custo unitário              |
| Operação e incidentes        | Gate comercial                | Parcial          | Exigir runbooks, plantão e incident commander                  |
| Prazo comercial              | 5–8 meses                     | 16–24 semanas    | Adotar 5–8 meses como faixa responsável                        |
| Maturidade funcional         | 12–18 meses                   | Não definida     | Adotar como horizonte de produto                               |

## Divergências resolvidas

### LivePix

O documento original tratava o StreamOS como uma camada sobre a LivePix. Todos os documentos V2 revisados e V3 corrigem essa tese. A decisão final é uma plataforma independente; LivePix pode existir apenas como importação ou migração futura.

### Escopo do MVP

Os documentos de features usam “MVP” para descrever o produto mínimo capaz de substituir uma plataforma existente, incluindo recursos amplos de streaming. O documento completo V3 divide melhor o risco:

1. MVP financeiro fechado.
2. Beta de streaming.
3. Lançamento comercial.

Essa divisão passa a ser a referência porque impede que TTS, mídia e gamificação atrasem ou fragilizem o ledger e a conciliação.

### Infraestrutura

O primeiro material sugeria AWS completa desde o início. Os documentos mais recentes recomendam começar com arquitetura portátil e econômica, usando serviços gerenciados somente quando reduzirem risco material. A decisão consolidada é:

- Desenvolvimento: Docker Compose local.
- Protótipo/beta: cloud econômica, SaaS e serviços por consumo.
- Produção financeira: componentes gerenciados conforme SLO, receita e risco.
- Escala: arquitetura híbrida, Multi-AZ e DR quando justificados.

### Arquitetura de aplicação

Os PDFs recomendam modular monolith bem separado no início. Isso é compatível com o monorepo atual: aplicações de borda separadas, contratos compartilhados e domínios financeiros isolados, sem criar microsserviços prematuramente.

### Prazo

A soma das fases e dependências externas torna 30–45 dias inviável para operação financeira. O prazo consolidado é:

- 5–8 meses para primeira versão comercial responsável.
- 12–18 meses para cobertura funcional madura.

## Lacunas incorporadas ao roadmap

- Disponibilidade do checkout: 99,95% no estágio comercial.
- Disponibilidade do painel: 99,9%.
- RPO financeiro de até 5 minutos.
- RTO financeiro de até 60 minutos.
- P95 da API interna de até 300 ms.
- P95 entre evento confirmado e overlay de até 2 segundos.
- Cenários de carga por criadores simultâneos, PPS, EPS e mídia.
- Gates de dinheiro, resiliência e operação antes de escalar.
- FinOps com TPV, take rate líquido, custo por pagamento e margem por criador.
- Estratégia de segundo parceiro financeiro e DR regional.
- Runbooks, plantão, suporte, incident commander e comunicação.

## Estado local frente ao roadmap

Já concluído:

- Monorepo com web, API, worker, realtime e overlay.
- PostgreSQL, Redis e Mailpit em Docker Compose.
- Prisma, migration inicial e seed.
- Schema com 22 tabelas dos principais domínios.
- Configuração validada, liveness e readiness.
- Build, lint, typecheck e testes automatizados.

Próximo marco:

- Identidade, organizações, sessões, recuperação de senha e onboarding sandbox.
