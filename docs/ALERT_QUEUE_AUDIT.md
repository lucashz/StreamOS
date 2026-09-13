# Auditoria da fila durável de alertas pagos

Atualizado em: 13/09/2026

Especificação: `docs/fila-duravel-alertas-pagos.md`.

## Fluxo atual

1. `PaymentsService.handleWebhook` valida o provedor e deduplica por
   `ProviderWebhook(provider, providerEventId)`.
2. `PaymentsService.confirm` grava `Payment`, atualiza `PaymentIntent`, cria os
   registros financeiros e eventos `OutboxEvent` na mesma transação Prisma.
3. `OutboxWorker` materializa eventos aceitos em `LiveQueueItem`, publica a
   Outbox no stream `streamos:events:durable` e consome o mesmo stream pelo
   grupo `streamos:realtime-dispatch`.
4. O worker seleciona um item `QUEUED` por organização, exige heartbeat recente,
   usa o lock `streamos:live-queue-lock:<organizationId>` e cria o evento de
   reprodução.
5. `RealtimeGateway` recebe os eventos pelo canal Pub/Sub `streamos:events`,
   reserva `OverlayDelivery.sequence` e envia `streamos:event` ao Browser Source.
6. O overlay React envia `RECEIVED`, `STARTED`, `COMPLETED` ou `FAILED` por
   `streamos:playback` e confirma a entrega final por `streamos:ack`.
7. O gateway persiste `OverlayPlaybackReceipt` e atualiza `LiveQueueItem`. O
   worker recupera reproduções cujo `playbackDeadline` venceu.
8. Na reconexão, o gateway reenvia `OverlayDelivery` sem ACK. Não existe ainda
   uma etapa `SYNC_STATE/RECONCILE`.

## Componentes existentes

- Pagamentos e webhook: `apps/api/src/payments/payments.service.ts`, providers em
  `apps/api/src/payments/*payment-provider.ts`.
- Controle e revisão manual: `apps/api/src/live-control/live-control.service.ts`
  e `apps/web/app/central-da-live/live-control-client.tsx`.
- Outbox, fila, lock, Redis Streams, timeout e webhooks externos:
  `apps/worker/src/outbox.worker.ts`.
- Política temporária de expiração e timeout:
  `apps/worker/src/live-queue.policy.ts`.
- Gateway, heartbeat, entrega, replay e recibos:
  `apps/realtime/src/realtime.gateway.ts`.
- Browser Source: `apps/overlay/app/overlay-client.tsx`.
- Modelos: `PaymentIntent`, `Payment`, `ProviderWebhook`, `OutboxEvent`,
  `OverlayChannel`, `OverlayDelivery`, `OverlayPlaybackReceipt`,
  `LiveQueueState`, `LiveQueueItem` e `LiveQueueAction`.
- Estados atuais da fila: `QUEUED`, `DISPATCHING`, `PLAYING`, `COMPLETED`,
  `MEDIA_FAILED`, `SKIPPED`, `FAILED` e `EXPIRED`.
- Testes: políticas Vitest nos pacotes e aplicações; integrações em `tools/e2e-*`;
  Browser Source em `tests/browser/streamos.spec.ts`.

## Infraestrutura encontrada

- Stream durável: `streamos:events:durable`.
- Dead letter stream: `streamos:events:dead-letter`.
- Consumer group: `streamos:realtime-dispatch`.
- Entrega realtime interna: Pub/Sub `streamos:events`.
- Recuperação de consumidor: `XAUTOCLAIM` após 30 segundos.
- Tentativas de transporte: hash Redis `streamos:event-delivery-attempts`, até
  cinco antes de dead letter.
- Lock: um lock Redis por organização, TTL de cinco segundos e liberação por
  comparação de token Lua.
- Sequência: `OverlayChannel.nextSequence`, atômica por canal. A fila usa
  `LiveQueueItem.position`, sem sequência imutável própria por organização.

## Matriz da especificação

| Requisito | Situação | Diagnóstico |
| --- | --- | --- |
| PostgreSQL como fonte de verdade | JÁ EXISTE | Fila e eventos persistem; retries de playback ainda não persistem. |
| Separar pagamento, alerta e tentativa | NÃO EXISTE | `LiveQueueItem` mistura alerta e execução; recibo referencia evento/canal. |
| Registro próprio de tentativa | NÃO EXISTE | Falta `playbackAttemptId`, contador, backoff e timestamps por tentativa. |
| Pagamento e Outbox na mesma transação | JÁ EXISTE | Confirmação, razão financeira e Outbox são transacionais. |
| Criar/materializar alerta na transação do pagamento | EXISTE PARCIALMENTE | A fila é materializada depois pelo worker e é idempotente por origem. |
| Webhook deduplicado | JÁ EXISTE | Chaves únicas por evento do provedor e por pagamento. |
| Publisher de Outbox recuperável | JÁ EXISTE | Publica antes de marcar `publishedAt`; repete itens não publicados. |
| Redis Streams com consumer group e ACK posterior | JÁ EXISTE | ACK ocorre após publicação no Pub/Sub, não após persistência de entrega OBS. |
| Recuperar mensagens pendentes | JÁ EXISTE | `XAUTOCLAIM`; tentativas ficam no Redis e não sobrevivem à perda total dele. |
| Ordenação imutável por organização | PRECISA SER MELHORADO | `position` atende ordenação operacional, mas pode mudar e não é contador dedicado. |
| Lock por organização + claim condicional | JÁ EXISTE | Redis lock e `updateMany` condicionado a `QUEUED`. |
| Worker único para escolher o próximo | JÁ EXISTE | Avanço duplicado do gateway foi removido no commit `d6dc798`. |
| Heartbeat antes do despacho | JÁ EXISTE | Exige `lastHeartbeatAt` nos últimos 45 segundos. |
| Estado derivado `WAITING_FOR_OBS` | EXISTE PARCIALMENTE | A espera existe como `QUEUED`, sem apresentação explícita. |
| Alerta pago nunca expira offline | CONFLITA COM A ESPECIFICAÇÃO | Política atual expira todos os itens não SongPix/VideoPix após 90 segundos. |
| TTL somente para testes | PRECISA SER MELHORADO | É necessário identificar teste pela origem e preservar todo evento pago. |
| `playbackAttemptId` persistente | NÃO EXISTE | Atualmente a identidade é o `OutboxEvent.eventId`. |
| Reenvio da mesma tentativa antes de `RECEIVED` | EXISTE PARCIALMENTE | Replay reenvia o mesmo evento sem ACK, mas não possui backoff/estado persistido. |
| Recibos idempotentes | JÁ EXISTE | Chave canal/evento e sequência monotônica impedem regressão de recibo. |
| Recibos com todos os identificadores | NÃO EXISTE | Faltam tentativa, alerta, pagamento, sequência, conexão e timestamp no contrato. |
| Não repetir depois de `STARTED` | CONFLITA COM A ESPECIFICAÇÃO | Refresh perde memória local e replay de entrega sem ACK pode tocar novamente. |
| `SYNC_STATE/RECONCILE` na conexão | NÃO EXISTE | O gateway executa replay imediatamente. |
| Idempotência durável no Browser Source | NÃO EXISTE | `seen.current` existe somente na memória da aba. |
| Backoff persistido | NÃO EXISTE | Retentativa de transporte usa Redis; playback não possui cronograma no banco. |
| Timeouts independentes por etapa | NÃO EXISTE | Há apenas `playbackDeadline`; mídia usa duração + margem. |
| Preparação antecipada de mídia | EXISTE PARCIALMENTE | Metadados são validados no checkout, mas parte é resolvida no início da reprodução. |
| Fallback de mídia | NÃO EXISTE | Falha termina como `MEDIA_FAILED`/`UNAVAILABLE`. |
| Snapshot imutável do alerta | EXISTE PARCIALMENTE | `metadata` guarda payload, mas apresentação é recalculada com configuração atual. |
| Revisão manual | EXISTE PARCIALMENTE | Central permite replay, concluir, pular e bloquear; falta `NEEDS_REVIEW` e diagnóstico da tentativa. |
| Política de backlog | NÃO EXISTE | Hoje há reprodução automática ou expiração indiscriminada. |
| Métricas por etapa | EXISTE PARCIALMENTE | Saúde calcula latências e falhas; faltam tentativa, retry, review e connection ID. |
| Recuperação após reinícios | EXISTE PARCIALMENTE | Fila sobrevive no PostgreSQL; estado da tentativa e reconciliação não sobrevivem integralmente. |
| Testes de falhas e concorrência exigidos | EXISTE PARCIALMENTE | Há E2E de fila/overlay e testes de recibos; faltam cenários de queda por etapa e dois workers. |

## Sobreposições e legado

- `LiveControlService.recoverTimeout` e `OutboxWorker.recoverExpiredPlayback`
  recuperam o mesmo timeout. O worker deve ser o componente canônico.
- `LiveControlService.transition` e `RealtimeGateway.playback` alteram diretamente
  estados da fila. As transições precisam migrar para uma política/serviço de
  domínio compartilhado sem criar outro processador concorrente.
- `OverlayDelivery` representa entrega de evento, enquanto
  `OverlayPlaybackReceipt` representa reprodução. Eles podem ser ampliados ou
  ligados a uma tentativa; não devem ser substituídos por tabelas equivalentes.
- O replay de entregas não confirmadas é útil, mas precisa acontecer depois da
  reconciliação e usar a identidade persistente da tentativa.
- A expiração genérica adicionada no commit `6283d4e` deve ficar restrita aos
  eventos de teste após a migração.

## Riscos de regressão

- Duplicar alertas que já tocaram quando o ACK final se perdeu.
- Bloquear a fila ao migrar itens `PLAYING` ou entregas antigas sem tentativa.
- Alterar a ordenação de SongPix e VideoPix ou seus tempos de mídia.
- Criar alerta genérico adicional para pagamentos ligados a campanha ou mídia.
- Perder compatibilidade com overlays abertos durante a implantação.
- Confundir ACK de transporte (`streamos:ack`) com recibo de reprodução.
- Introduzir dois componentes selecionando o próximo item.

## Direção canônica da migração

- Manter `LiveQueueItem` como registro persistente do alerta e ampliar seu
  significado, preservando IDs e dados existentes.
- Criar somente o registro ausente de tentativa de reprodução e relacioná-lo às
  estruturas existentes de entrega e recibo.
- Manter o `OutboxWorker` como único seletor e reconciliador da fila.
- Manter `RealtimeGateway` como transporte autenticado e persistência dos
  recibos, sem selecionar o próximo alerta.
- Manter `OverlayDelivery` para ordenação/ACK de transporte.
- Evoluir o Browser Source para idempotência por tentativa e sincronização antes
  do replay.
