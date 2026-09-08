# StreamOS — Roadmap e plano de implementação

Versão: 1.0
Base: `Projeto StreamOS.pdf` e `StreamOS-Produto-e-Features-Ilustrado.pdf`
Referência principal: documento de produto v2.0 (julho de 2026)

## 1. Direção do produto

O StreamOS será uma plataforma independente de monetização para criadores. A experiência de cadastro, checkout, carteira, alertas, overlays e saque pertence ao StreamOS; os trilhos financeiros serão fornecidos inicialmente por parceiros regulados.

O produto não dependerá da LivePix. Uma integração futura poderá servir para importação ou migração, sem entrar no caminho crítico.

### Promessa do MVP

O criador abre uma conta, conclui a verificação, publica sua página, recebe um Pix, exibe o alerta no OBS, acompanha o saldo e solicita o saque dentro do StreamOS.

### Métricas norteadoras

- Tempo entre confirmação do pagamento e alerta no overlay: P95 menor que 2 segundos.
- Disponibilidade do checkout e recebimento de webhooks: mínimo de 99,9% no beta.
- Divergências financeiras sem tratamento: zero; toda divergência abre incidente.
- Taxa de entrega de eventos ao overlay após reconexão: 100% para eventos persistidos.
- Conversão da página pública, ticket médio, frequência de apoio e retenção de criadores.

## 2. Premissas de execução

- A estimativa considera uma equipe de 5 a 7 pessoas: produto/design, 2 ou 3 backend, frontend, QA/automação e DevOps compartilhado.
- O primeiro beta não custodiará dinheiro diretamente. Um parceiro regulado executará conta de pagamento, Pix, liquidação, KYC e saque conforme contrato e validação jurídica.
- Cartão, recorrência, mídia enviada pelo apoiador, IA e gamificação avançada ficam fora do primeiro lançamento público.
- O ledger interno continua obrigatório mesmo que o parceiro mantenha seu próprio extrato.
- Nenhuma ação de IA poderá autorizar saque, editar saldo ou alterar lançamentos financeiros.

## 3. Escopo por versão

### MVP fechado — receber, alertar e sacar

Inclui:

- Cadastro, login, recuperação, 2FA e aceite de termos.
- KYC/KYB integrado ao parceiro financeiro.
- Perfil e página pública do criador.
- Checkout Pix dinâmico, copia e cola, QR Code, apelido, mensagem e anonimato.
- Webhooks financeiros assinados, idempotentes e reprocessáveis.
- Ledger de dupla entrada, saldo pendente/disponível/bloqueado, taxas e saque Pix.
- Extrato básico e recibo do apoiador.
- Browser Source para OBS com autenticação, WebSocket, reconexão, fila, replay e teste.
- Alerta de texto com tema básico, som e moderação determinística.
- Meta simples e dashboard essencial.
- Backoffice mínimo para suporte, auditoria, bloqueio e reprocessamento.
- Logs, métricas, alertas, backups e resposta a incidentes.

Não inclui:

- Cartão, Pix Automático ou assinaturas.
- TTS por IA, upload de imagem, áudio ou vídeo.
- Boss Battle, streak, loot drops e PixAthon.
- Aplicativo móvel, marketplace, white-label ou API pública.

### V1 — retenção e aumento de receita

- TTS com quotas, cache, fila e moderação.
- Editor visual de alertas e múltiplos perfis/cenas.
- Metas dinâmicas, ranking sazonal e Boss Battle.
- Motor de regras configurável com cooldown, limites e auditoria.
- Assinatura por cartão e/ou Pix Automático, após homologação.
- Discord e uma integração de streaming prioritária.
- Analytics por live, campanha, ticket e recorrência.

### V2 — plataforma e inteligência

- Mídia moderada: imagem, GIF, áudio e vídeo curto.
- Spotify/YouTube por adaptadores e filas moderadas.
- Coach de monetização e resumo pós-live.
- Detecção de momentos e geração assistida de highlights.
- App móvel focado no controle durante a transmissão.
- Webhooks e API para parceiros selecionados.

### V3 — ecossistema

- Marketplace de templates, widgets e extensões.
- API pública com portal, chaves, quotas e versionamento.
- Equipes, múltiplos canais, Studio e Enterprise.
- White-label, SLA e implantação contratual.

## 4. Roadmap de entrega consolidado

Prazo de referência: 5 a 8 meses para uma primeira versão comercial responsável e 12 a 18 meses para cobertura funcional madura. O parceiro financeiro, o enquadramento jurídico e a qualidade operacional são dependências do caminho crítico.

### Fase 0 — fundamentos e redução de risco (4 a 8 semanas)

Entregáveis:

- PRD e jornadas de criador, apoiador, suporte e risco.
- Modelo financeiro e jurídico do fluxo de recursos.
- Avaliação de pelo menos dois parceiros para Pix, KYC, saque, reversões obrigatórias, conciliação, SLA, custo e portabilidade.
- Threat model, classificação de dados, política de risco e contratos de dados.
- Protótipos de onboarding, checkout, dashboard e alerta.
- Prova técnica em sandbox: pagamento → webhook → ledger/outbox → overlay.
- Arquitetura modular, modelo do ledger e ADRs críticos.

Gate de saída:

- Parceiro principal escolhido e contingência conhecida.
- Fluxo completo demonstrado em sandbox.
- Ledger revisado por especialista em sistemas financeiros.
- Parecer jurídico/regulatório e orçamento do MVP aprovados.

### Fase 1 — MVP financeiro fechado (8 a 12 semanas)

Entregáveis:

- Fundações locais e cloud, CI/CD, observabilidade e gestão de segredos.
- Cadastro, sessões, 2FA, organizações, RBAC, consentimentos e auditoria.
- KYC/KYB, Pix, webhooks assinados e máquina de estados.
- Ledger imutável, taxas, reservas, saldo e saque.
- Conciliação automática e backoffice de risco/suporte.
- Testes controlados com dinheiro real e limites baixos.

Gate de saída:

- Conciliação fecha 100% no período de validação.
- Idempotência provada para comandos e eventos repetidos ou fora de ordem.
- Devolução e saque testados com autenticação forte e titularidade.
- Nenhum defeito crítico aberto em ledger, autorização ou conciliação.

### Fase 2 — beta de streaming (6 a 8 semanas)

Entregáveis:

- Página pública, checkout responsivo e recibo.
- Browser Source protegido, WebSocket, ACK, retry e retomada.
- Fila ao vivo, replay, teste, texto, som e meta simples.
- TTS limitado por quota e moderação prévia de texto.
- Dashboard de receita, ticket, saldo, extrato e configuração.
- Piloto com 10 a 20 criadores e rollout por feature flags.

Gate de saída:

- P95 pagamento confirmado → overlay de até 2 segundos.
- Reconexão do OBS recupera eventos sem perda ou duplicação visual.
- Métricas, alertas e suporte sustentam o beta por pelo menos duas semanas.
- Feedback comprova entendimento da jornada sem suporte manual constante.

### Fase 3 — lançamento comercial (6 a 10 semanas)

Entregáveis:

- Cartão tokenizado no adquirente, chargeback e comunicação de falha.
- Antifraude calibrado, holds, reservas e limites por risco.
- SLOs/SLIs, WAF, rate limit, pentest e resposta a incidentes.
- Backups imutáveis, restauração testada e estratégia Multi-AZ para componentes críticos.
- Runbooks, plantão, incident commander e comunicação de status.
- Operação comercial, suporte e política de moderação/contestação.

Gate de saída:

- Restore e falhas de nó, fila e parceiro simulados com sucesso.
- Checkout, painel, API e overlay dentro dos SLOs definidos.
- Chargeback, fraude, suporte e incidentes possuem owner e procedimento.
- Unidade econômica mínima aprovada para abrir aquisição.

### Fase 4 — retenção e recorrência (8 a 12 semanas)

Entregáveis:

- Pix Automático e/ou assinatura por cartão.
- Motor de regras, metas dinâmicas, ranking e temporadas.
- Boss Battle, streak, PixAthon e recompensas transparentes.
- Editor visual, perfis de cena e mídia moderada progressivamente.
- Integrações priorizadas pelo beta e analytics de campanhas.
- Coach de monetização e resumo pós-live com guardrails.

### Fase 5 — plataforma e escala (contínua)

Entregáveis:

- API pública, marketplace, Studio, Enterprise e white-label.
- Aplicativo móvel e automações avançadas.
- Segundo parceiro financeiro e estratégia de failover operacional.
- DR regional, testes de cenários virais e otimização de TCO.
- Evolução para serviços separados apenas onde escala, risco ou equipes justificarem.

## 5. Arquitetura inicial recomendada

### Stack

- Monorepo TypeScript com `pnpm` e Turborepo ou Nx.
- Web: Next.js.
- API: NestJS com REST; OpenAPI desde o início.
- Realtime: gateway WebSocket separado logicamente, usando Redis para fan-out.
- Workers: NestJS/BullMQ para webhooks, moderação, notificações, conciliação e mídia.
- Dados: PostgreSQL, Redis e armazenamento compatível com S3.
- Infraestrutura: containers e IaC. Começar com a menor topologia gerenciada que cumpra segurança e disponibilidade; migrar para ECS/Fargate quando carga ou operação justificarem.

### Estrutura sugerida

```text
apps/
  web/             painel e páginas públicas
  api/             API e autenticação
  realtime/        entrega de eventos aos overlays
  worker/          filas e tarefas assíncronas
  overlay/         browser source para OBS
packages/
  contracts/       schemas, eventos e clientes tipados
  database/        migrations e acesso a dados
  ledger/          regras e invariantes financeiras
  ui/              design system
  config/          lint, TypeScript e ambiente
infra/
  environments/    IaC por ambiente
docs/
  adr/             decisões de arquitetura
  product/         PRDs e jornadas
```

### Domínios do backend

- Identity: usuários, organizações, equipe, 2FA e consentimentos.
- Creator: perfil, página, configuração e canais.
- Compliance: KYC/KYB, risco, bloqueios e auditoria.
- Payments: cobranças, provedores, webhooks e estados.
- Ledger: contas, lançamentos, saldos, taxas e reservas.
- Payouts: beneficiários, saques e limites.
- Streaming: sessões, overlays, alertas e fila.
- Campaigns: metas e, depois, gamificação/motor de regras.
- Moderation: texto, mídia, decisões e apelação.
- Analytics: eventos de produto e agregações; nunca como fonte do saldo.

## 6. Regras técnicas não negociáveis

- Valores monetários em inteiros na menor unidade, nunca em ponto flutuante.
- Lançamentos do ledger são imutáveis; correções usam lançamentos compensatórios.
- Toda entrada externa possui chave de idempotência e payload original preservado de forma segura.
- O estado confirmado pelo parceiro não é atualizado diretamente pelo frontend.
- Separação entre evento financeiro, evento de domínio e evento visual do overlay.
- Outbox transacional para publicar eventos após commits financeiros.
- PII criptografada, acesso mínimo, rotação de segredos e trilha de auditoria.
- Logs não contêm tokens, documentos, dados completos de pagamento ou mensagens privadas.
- Saques usam 2FA, limites, verificação de titularidade e análise de risco.
- Feature flags e kill switches para pagamento, saque, TTS, mídia e campanhas.

## 7. Estratégia de testes

- Unitários: regras de taxas, máquina de estados, ledger e campanhas.
- Propriedade/invariantes: débitos igualam créditos; saldo nunca surge sem lançamento.
- Integração: banco real em container, Redis, filas e webhooks do parceiro.
- Contrato: payloads e versões da API do parceiro financeiro.
- E2E: cadastro → KYC → Pix → alerta → saldo → saque.
- Caos controlado: webhook duplicado/atrasado, Redis indisponível, worker reiniciado e OBS desconectado.
- Performance: picos de pagamentos e fan-out de overlays.
- Segurança: autorização por objeto, replay de webhook, enumeração, upload, SSRF e abuso de tokens.
- Conciliação: fixtures com faltas, duplicidades, estornos e diferenças de centavos.

## 8. Backlog inicial — primeiros quatro sprints

### Sprint 1 — produto e prova técnica

- Fechar PRD e histórias da jornada principal.
- Criar protótipos do checkout, painel e overlay.
- Avaliar parceiros financeiros e solicitar sandboxes.
- Definir arquitetura, eventos e modelo conceitual do ledger.
- Executar spike WebSocket no OBS.

### Sprint 2 — fundação

- Criar monorepo, lint, testes, CI e deploy de staging.
- Implementar identidade, sessão, organizações e auditoria.
- Subir PostgreSQL, Redis e observabilidade.
- Criar contratos de eventos e outbox.

### Sprint 3 — pagamento

- Integrar criação de Pix em sandbox.
- Receber e validar webhooks.
- Implementar máquina de estados e idempotência.
- Criar primeiras contas e lançamentos do ledger.

### Sprint 4 — experiência ponta a ponta

- Criar página pública mínima.
- Entregar evento confirmado ao Browser Source.
- Exibir alerta básico e meta.
- Mostrar transação e saldo projetado no painel.
- Automatizar o primeiro E2E completo.

## 9. Decisões pendentes antes do desenvolvimento pesado

1. Parceiro financeiro e modelo contratual/regulatório.
2. País e moeda do lançamento inicial — recomendação: Brasil e BRL somente.
3. Política de taxas, prazo de disponibilidade e reservas de risco.
4. Pessoa física, pessoa jurídica ou ambas no primeiro beta.
5. Critérios e limites de saque.
6. Nível de anonimato permitido e dados exibidos ao criador.
7. Política de conteúdo, moderação, denúncias e apelações.
8. Provedor de infraestrutura e região de dados.
9. Estratégia de suporte e operação fora do horário comercial.
10. Primeiro segmento do beta: streamers pequenos/médios, plataforma e tipo de conteúdo.

## 10. Principais riscos e mitigação

| Risco                                        | Impacto                      | Mitigação inicial                                                        |
| -------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| Dependência ou demora do parceiro financeiro | Bloqueia o caminho crítico   | Avaliar ao menos dois parceiros e construir uma camada de adaptação      |
| Erro de ledger ou conciliação                | Perda financeira e confiança | Dupla entrada, invariantes, revisão especializada e reconciliação diária |
| Fraude, conta laranja e saque indevido       | Perda financeira/regulatória | KYC, device/risk signals, holds, limites, 2FA e revisão manual           |
| Webhook duplicado ou fora de ordem           | Saldo/alerta incorreto       | Idempotência, máquina de estados, outbox e reprocessamento               |
| Conteúdo ofensivo no alerta                  | Dano ao criador e à marca    | Filtros antes da transmissão, controles e aprovação opcional             |
| Pico durante live grande                     | Queda no momento crítico     | Filas, backpressure, autoscaling e testes de carga                       |
| Escopo amplo demais                          | Atraso e baixa qualidade     | Proteger o MVP e liberar gamificação somente após o núcleo financeiro    |
| Custo de IA/mídia                            | Margem negativa              | Quotas por plano, cache, limites e processamento assíncrono              |

## 11. Definição de sucesso do MVP

O MVP estará pronto para ampliar o beta quando:

- Um criador concluir onboarding e KYC sem intervenção da equipe em casos normais.
- Um apoiador pagar por Pix e receber confirmação/recibo.
- O alerta aparecer no OBS dentro da meta de latência.
- O valor correto aparecer no ledger, extrato e saldo conforme liquidação.
- O criador solicitar saque com autenticação forte e receber o valor pelo parceiro.
- Webhooks repetidos, atrasados e fora de ordem forem processados sem inconsistência.
- Suporte conseguir investigar qualquer transação por uma trilha auditável.
- Conciliação, backup, restauração e resposta a incidentes tiverem sido testados.

## 12. Metas de serviço

Metas para o estágio comercial, medidas por janela e excluindo manutenções previamente comunicadas conforme contrato:

| Indicador                          |    Meta inicial |
| ---------------------------------- | --------------: |
| Disponibilidade do checkout        |          99,95% |
| Disponibilidade do painel          |           99,9% |
| RPO financeiro                     |   até 5 minutos |
| RTO financeiro                     |  até 60 minutos |
| P95 da API interna                 |      até 300 ms |
| Evento confirmado → overlay P95    |  até 2 segundos |
| Movimentos financeiros rastreáveis |            100% |
| Detecção de incidente crítico      |  até 15 minutos |
| Teste de recuperação               | 2 vezes por ano |

Cada SLO deverá possuir SLI, fonte de telemetria, janela, owner, orçamento de erro e procedimento de escalonamento antes do lançamento comercial.

## 13. Capacidade e cenários de escala

O dimensionamento será guiado pelo pico de lives, não pela média. As variáveis obrigatórias são:

- Criadores ativos simultâneos.
- Espectadores por live no pico.
- Pagamentos por segundo (PPS).
- Eventos de overlay por segundo (EPS).
- Tamanho e visualizações de mídia.
- Retenção de transações e mídia.
- Percentual de eventos com TTS/moderação.
- Fraude e chargeback como percentual do TPV.

Cenários iniciais para testes:

| Cenário   | Criadores ativos | PPS pico | Eventos/s |
| --------- | ---------------: | -------: | --------: |
| Validação |              500 |        5 |        25 |
| Tração    |           10 mil |       75 |       500 |
| Escala    |          100 mil |     750+ |    5 mil+ |

Esses números são hipóteses. A telemetria do beta deverá substituí-los e recalibrar arquitetura e custos.

## 14. Estratégia de infraestrutura

- Local: Docker Compose com PostgreSQL, Redis e Mailpit.
- Protótipo e beta: cloud econômica, componentes open source e SaaS por consumo.
- Core financeiro comercial: banco, segredos, backups e perímetro gerenciados quando reduzirem risco material.
- Escala: arquitetura híbrida, Multi-AZ, DR e redundância de fornecedor conforme SLO e receita.
- Aplicação: modular monolith com domínios fortes; extração de serviços somente por escala, risco ou autonomia de equipe.
- Portabilidade: todo fornecedor precisa de exportação de dados, contrato de API e alternativa documentada.

Faixas dos PDFs são direcionais e exigem cotação atualizada:

- Protótipo/beta econômico: aproximadamente R$ 300–2.500/mês.
- AWS em beta: aproximadamente R$ 2 mil–8 mil/mês.
- AWS comercial com HA: aproximadamente R$ 15 mil–60 mil/mês.

Taxas financeiras, adquirência, fraude, IA/TTS, equipe, impostos e reservas não estão incluídos nessas faixas.

## 15. FinOps e unidade econômica

Métrica central:

```text
margem_de_contribuição = receita_de_taxas − custos_de_pagamento − fraude − infraestrutura_variável − suporte_variável
```

Indicadores obrigatórios:

- TPV e take rate líquido.
- Custo por pagamento e por mil eventos.
- Margem por criador e por plano.
- Fraude/chargeback e perda líquida.
- Storage, CDN, egress e custo de mídia.
- Custo de TTS/moderação por plano.
- LTV/CAC e variação entre custo previsto e realizado.

Guardrails:

- Tags de ambiente, produto, owner, criticidade e centro de custo.
- Budgets e alertas de anomalia sem bloquear fluxo financeiro legítimo.
- Showback semanal e revisão de custos após 30, 90 e 180 dias de produção.
- Otimização orientada por telemetria, sem sacrificar prazo ou segurança financeira.
