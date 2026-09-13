# Fila durável de alertas pagos

## Objetivo

Substituir a regra atual de expiração em 90 segundos por uma fila durável e recuperável usando a arquitetura existente no projeto: **NestJS, PostgreSQL, Prisma ORM, Redis Streams com ioredis, Socket.IO/WebSocket, Next.js/React, Vitest, Playwright, Docker Compose e pnpm**.

Um pagamento confirmado nunca pode desaparecer ou virar `EXPIRED` porque o OBS ficou offline, houve reinício do backend ou ocorreu uma falha temporária entre o servidor e o Browser Source.

> **Garantia principal:** nenhum alerta vinculado a pagamento confirmado pode desaparecer sem chegar a um estado final auditável.

## Tecnologias e responsabilidades

| Responsabilidade | Tecnologia | Aplicação |
| --- | --- | --- |
| Registro permanente | PostgreSQL | Guarda alertas pagos, posição, estado, tentativas e horários. |
| Acesso ao banco | Prisma ORM | Executa transações, atualizações condicionais e controles idempotentes. |
| Processamento da fila | NestJS Worker | Materializa eventos, seleciona o próximo alerta, controla timeouts e processa tentativas. |
| Mensageria durável | Redis Streams + ioredis | Transporta eventos entre API, worker e realtime com ACK e recuperação de mensagens pendentes. |
| Publicação confiável | Transactional Outbox no PostgreSQL | Persiste o pagamento e o evento antes da publicação no Redis. |
| Comunicação com o OBS | Socket.IO/WebSocket | Envia alertas ao Browser Source e recebe os recibos de reprodução. |
| Servidor realtime | NestJS Gateway + Socket.IO | Autentica o overlay, registra heartbeat e processa recibos. |
| Browser Source | Next.js + React | Renderiza alertas, reproduz mídia e devolve recibos ao servidor. |
| Identificação de tentativas | UUID + Prisma | Atribui um `playbackAttemptId` a cada reprodução. |
| Reenvio automático | NestJS Worker + PostgreSQL | Localiza tentativas vencidas e executa reenvio seguro. |
| Backoff | PostgreSQL | Persiste `nextAttemptAt`, número de tentativas e último erro. |
| Presença do OBS | Heartbeat via Socket.IO | Mantém `lastHeartbeatAt` e permite despacho apenas para canal ativo. |
| Concorrência | Redis Lock + condições no PostgreSQL | Impede dois workers de iniciarem alertas simultaneamente para a mesma organização. |
| Revisão manual | Next.js + API NestJS | Exibe falhas e oferece reenvio, cancelamento, conclusão e pulo manual. |
| Mídia | Storage configurado no projeto | Fornece URLs e permite validar disponibilidade antes da reprodução. |
| Testes unitários e integração | Vitest | Valida transições, retentativas, expiração e idempotência. |
| Testes do Browser Source | Playwright | Simula desconexões, reconexões e alertas completos. |
| Ambiente local | Docker Compose | Executa PostgreSQL, Redis e serviços auxiliares. |
| Monorepo | pnpm | Gerencia pacotes, builds e testes direcionados. |

## Regras de implementação

### 1. PostgreSQL como fonte de verdade

- Persistir permanentemente todo alerta pago.
- Salvar `alertId`, `paymentId`, organização/streamer, `sequenceNumber`, estado, snapshot de reprodução, timestamps, tentativas, último erro e último recibo.
- Não usar Redis como única fonte da fila.
- Permitir reconstrução integral após reinício de Redis, API, Gateway ou Worker.
- Manter TTL apenas para alertas de teste ou eventos explicitamente temporários.

### 2. Separar pagamento, alerta e tentativa

Estados sugeridos para pagamento:

- `PENDING`
- `PAID`
- `REFUNDED`
- `CANCELED`

Estados persistentes do alerta:

- `CREATED`
- `PREPARING`
- `READY`
- `COMPLETED`
- `CANCELED`
- `NEEDS_REVIEW`

Estados da tentativa de reprodução:

- `CREATED`
- `DISPATCHED`
- `RECEIVED`
- `STARTED`
- `COMPLETED`
- `FAILED`
- `NEEDS_REVIEW`

Não utilizar `EXPIRED` para alertas associados a pagamentos confirmados. `WAITING_FOR_OBS` pode ser exibido como estado derivado da conexão, mantendo o alerta persistido como `READY`.

### 3. Modelo da tentativa de reprodução

Cada tentativa deve possuir um registro próprio no PostgreSQL contendo, no mínimo:

- `playbackAttemptId` UUID;
- `alertId`;
- `sequenceNumber`;
- estado;
- `dispatchedAt`;
- `receivedAt`;
- `startedAt`;
- `completedAt`;
- `failedAt`;
- `attemptNumber`;
- `nextAttemptAt`;
- `lastAttemptAt`;
- `lastError`.

### 4. Pagamento e Outbox na mesma transação

Ao receber a confirmação do gateway na API NestJS:

1. validar a assinatura do webhook;
2. deduplicar pelo identificador do evento ou pagamento do provedor;
3. marcar o pagamento como `PAID`;
4. criar ou materializar o alerta;
5. criar o registro da Transactional Outbox;
6. confirmar tudo em uma única transação Prisma/PostgreSQL;
7. responder rapidamente com `2xx`.

TTS, validação de vídeo, preparação de mídia e comunicação com o OBS devem ocorrer fora do request do webhook.

### 5. Publicação da Outbox no Redis Streams

- Um Outbox Publisher confiável publica os eventos pendentes no Redis Streams.
- Marcar o evento como publicado somente depois da publicação bem-sucedida.
- Se o processo cair antes da publicação, o registro permanece disponível para nova tentativa.
- A publicação e o consumo devem ser idempotentes.
- Webhooks duplicados não podem criar dois alertas.

### 6. Redis Streams como transporte

- Usar Consumer Groups.
- Não confirmar uma mensagem somente porque ela foi lida.
- Executar o ACK no Redis apenas depois que o processamento relevante estiver persistido.
- Recuperar mensagens pendentes de consumidores que morreram.
- Usar Redis para transporte e coordenação; manter o estado definitivo do negócio no PostgreSQL.

### 7. Ordenação por organização

- Gerar `sequenceNumber` crescente por organização, streamer ou canal.
- O Worker deve selecionar o próximo alerta elegível respeitando a sequência.
- Um alerta posterior não deve ultrapassar outro legitimamente em reprodução.
- Falhas de mídia tratáveis por fallback não devem bloquear toda a fila.

### 8. Controle de concorrência

- Usar Redis Lock por organização/canal, nunca um lock global.
- Configurar TTL seguro e liberação controlada.
- Complementar o lock com atualizações condicionais no PostgreSQL via Prisma.
- O Redis Lock é proteção adicional e não a única garantia de consistência.

### 9. Seleção e despacho pelo Worker

Antes de despachar um alerta `READY`, o NestJS Worker deve:

1. verificar se já existe reprodução ativa para a organização;
2. conferir o heartbeat do overlay;
3. conferir `nextAttemptAt`;
4. adquirir o lock da organização;
5. validar a disponibilidade da mídia;
6. criar ou reutilizar uma tentativa válida;
7. persistir o estado antes de enviar ao realtime.

### 10. Reenvio idempotente

Se uma tentativa `DISPATCHED` não receber `RECEIVED`, reenviar a mesma tentativa com o mesmo `playbackAttemptId`. Não criar uma tentativa nova a cada simples reenvio.

O Browser Source deve tratar `playbackAttemptId` como chave idempotente. Ao receber novamente um ID conhecido, não deve reproduzir outra vez; deve devolver o estado já conhecido.

### 11. Entrega via Socket.IO

O NestJS Gateway deve localizar a conexão autenticada da organização e enviar ao Browser Source:

- `alertId`;
- `paymentId`;
- `playbackAttemptId`;
- `sequenceNumber`;
- `connectionId`;
- timestamp;
- dados e snapshot do alerta;
- duração esperada;
- informações de mídia.

### 12. Recibos de reprodução

#### `RECEIVED`

- Enviar assim que o Browser Source aceitar e registrar localmente a tentativa.
- Persistir no PostgreSQL por meio do Gateway/API.
- Significa que o overlay conhece a tentativa, mas não que a reprodução começou.

#### `STARTED`

- Enviar quando o alerta efetivamente aparecer ou a mídia/TTS começar.
- Persistir `startedAt`.
- Depois desse estado, não executar replay automático.

#### `COMPLETED`

- Enviar ao término da reprodução.
- Persistir a conclusão da tentativa e do alerta.
- Liberar o próximo item com base no estado persistido, não apenas em memória.

#### `FAILED`

- Enviar quando houver falha identificável.
- Incluir código e motivo.
- Diferenciar falha de mídia, renderização, áudio e erro interno do overlay.
- O Worker decide entre retry, fallback, avanço da fila ou `NEEDS_REVIEW`.

Todos os recibos devem conter `alertId`, `playbackAttemptId`, `sequenceNumber`, `connectionId` e timestamp.

### 13. Política de reenvio e reconciliação

- **Sem `RECEIVED`:** reenviar a mesma tentativa com o mesmo `playbackAttemptId`, registrando retry e `nextAttemptAt`.
- **Com `RECEIVED`, mas sem `STARTED`:** não criar imediatamente outra tentativa. Primeiro sincronizar o estado do Browser Source.
- **Depois de `STARTED`:** nunca repetir automaticamente apenas porque `COMPLETED` não chegou.
- **Estado ambíguo:** reconciliar e, se não houver conclusão segura, enviar para `NEEDS_REVIEW`.

Na reconciliação, verificar:

- tentativa atual;
- último `playbackAttemptId` conhecido;
- `lastReceivedSequence`;
- `lastStartedSequence`;
- `lastCompletedSequence`;
- IDs processados recentemente.

### 14. Heartbeat

O Browser Source deve enviar heartbeat periódico via Socket.IO. Registrar:

- `connectionId`;
- `connectedAt`;
- `lastHeartbeatAt`;
- versão do overlay;
- estado atual;
- tentativa e sequência atuais.

Estados operacionais sugeridos:

- `ONLINE`
- `DEGRADED`
- `OFFLINE`

A ausência de heartbeat deve impedir novos despachos, mas nunca cancelar ou expirar alertas pagos.

### 15. Sincronização após reconexão

Ao conectar ou reconectar, o Browser Source não deve receber imediatamente o próximo alerta. Primeiro deve ocorrer `SYNC_STATE`:

1. o overlay informa tentativa atual, sequências conhecidas e IDs recentes;
2. o servidor compara os dados com o PostgreSQL;
3. os estados são reconciliados;
4. somente depois o Worker libera o próximo alerta elegível.

Essa etapa impede replay quando o alerta foi reproduzido, mas o ACK se perdeu.

### 16. Idempotência no Browser Source

- Manter os `playbackAttemptId` processados recentemente.
- Preservar informações mínimas durante refresh ou reconexão, quando possível.
- Para tentativa conhecida, retornar o estado `RECEIVED`, `STARTED` ou `COMPLETED`, sem iniciar nova reprodução.

### 17. Backoff persistido

Persistir `attemptNumber`, `nextAttemptAt`, `lastAttemptAt` e `lastError` no PostgreSQL.

Backoff inicial sugerido, com pequeno jitter:

- aproximadamente 2 segundos;
- 5 segundos;
- 10 segundos;
- 30 segundos.

Reiniciar o Worker não pode zerar o cronograma de retries.

### 18. Timeouts independentes

- `DISPATCHED → RECEIVED`: aproximadamente 5 segundos.
- `RECEIVED → STARTED`: aproximadamente 10 segundos.
- `STARTED → COMPLETED`: duração conhecida da mídia ou alerta, mais margem.

Não usar um timeout global de 30 segundos para vídeos ou áudios longos.

### 19. Preparação de mídia

Antes de mudar um alerta para `READY`:

- preparar o TTS;
- validar arquivo e URL;
- verificar provider e disponibilidade;
- determinar duração;
- validar restrições;
- registrar os metadados necessários.

O Worker não deve descobrir apenas no momento da reprodução que o recurso não existe.

### 20. Fallback de mídia

Falha de SongPix, VideoPix, TTS ou outra mídia não deve necessariamente cancelar a contribuição. Quando possível, reproduzir fallback contendo:

- nome do doador;
- valor;
- mensagem;
- visual padrão.

Registrar a falha de mídia e continuar a fila.

### 21. Snapshot do alerta pago

Persistir no PostgreSQL uma representação suficiente do alerta no momento de sua criação ou preparação:

- nome do doador;
- valor;
- mensagem;
- voz e resultado do TTS;
- mídia;
- duração;
- configuração visual relevante;
- parâmetros de reprodução.

Mudanças futuras na configuração do streamer não devem alterar nem quebrar alertas antigos.

### 22. Revisão manual

A Central da Live, implementada em Next.js com API NestJS, deve exibir alertas em `NEEDS_REVIEW` com:

- contribuição, valor e usuário;
- data e horário;
- tentativa e quantidade de retries;
- último erro e último ACK;
- último heartbeat e estado da conexão.

Ações disponíveis:

- **Tentar novamente**
- **Marcar como reproduzido**
- **Pular**
- **Cancelar**

Toda ação manual deve gerar registro de auditoria.

### 23. Backlog acumulado

Se o OBS ficar offline e acumular muitos alertas, preservar todos no PostgreSQL, mas não necessariamente reproduzir todo o backlog sem controle.

Criar política configurável para:

- reproduzir automaticamente apenas alertas recentes;
- solicitar confirmação para backlog antigo;
- permitir seleção manual;
- marcar itens como não reproduzidos, mantendo registro auditável.

### 24. Testes com Vitest

Cobrir pelo menos:

- pagamento confirmado nunca expira;
- alerta de teste expira;
- webhook duplicado não cria outro alerta;
- mesmo `playbackAttemptId` não cria nova reprodução;
- retry sem `RECEIVED`;
- `RECEIVED` sem `STARTED`;
- queda depois de `STARTED`;
- reinício do Worker ou Redis;
- dois workers concorrentes;
- ordenação por organização;
- fallback de mídia;
- recuperação de mensagens pendentes do Redis Streams.

### 25. Testes com Playwright

Simular o Browser Source em cenários de:

- conexão normal;
- OBS offline;
- desconexão antes de `RECEIVED`;
- desconexão depois de `RECEIVED`;
- desconexão depois de `STARTED`;
- reconexão e refresh;
- ACK e evento duplicados;
- vídeo longo;
- fila com vários alertas.

Validar que nenhum cenário faz uma contribuição paga desaparecer ou tocar duas vezes de forma evitável.

### 26. Docker Compose e recuperação

Usar o ambiente local existente com PostgreSQL e Redis para testes de integração, incluindo reinício real dos serviços. Validar que:

- reiniciar Redis não apaga a fila permanente;
- reiniciar Worker não perde retries;
- reiniciar Gateway não perde o estado de negócio;
- reiniciar PostgreSQL após a persistência permite recuperar corretamente a fila.

### 27. Observabilidade

Medir as latências:

- pagamento confirmado → alerta criado;
- alerta criado → `READY`;
- `READY → DISPATCHED`;
- `DISPATCHED → RECEIVED`;
- `RECEIVED → STARTED`;
- `STARTED → COMPLETED`.

Monitorar também:

- backlog por organização;
- alerta pendente mais antigo;
- quantidade de retries;
- overlays online e offline;
- falhas de mídia;
- itens em revisão;
- duplicações bloqueadas pela idempotência.

Incluir nos logs:

- `organizationId`;
- `alertId`;
- `paymentId`;
- `playbackAttemptId`;
- `sequenceNumber`;
- `connectionId`.

### 28. Sobrevivência a falhas

Não manter estado crítico exclusivamente:

- na memória do NestJS;
- no Socket.IO;
- no Browser Source;
- no Redis.

O PostgreSQL deve permitir reconstruir o estado do alerta, a posição e o cronograma de retries após qualquer reinício individual. Redis Streams melhora o transporte e a recuperação, mas não substitui a persistência de negócio.

## Fluxo principal esperado

```text
Gateway de pagamento
        ↓
API NestJS
        ↓
Transação Prisma/PostgreSQL
   ├─ pagamento PAID
   ├─ alerta criado
   └─ Transactional Outbox
        ↓
Outbox Publisher
        ↓
Redis Streams
        ↓
Consumer Group / NestJS Worker
        ↓
PostgreSQL + heartbeat + Redis Lock
        ↓
PlaybackAttempt persistida
        ↓
Redis Streams
        ↓
NestJS Socket.IO Gateway
        ↓
Next.js / React Browser Source
        ↓
RECEIVED → PostgreSQL
        ↓
STARTED → PostgreSQL
        ↓
COMPLETED → PostgreSQL
        ↓
Worker libera o próximo alerta
```

## Fluxo de reconexão

```text
Browser Source conecta
        ↓
Socket.IO Gateway autentica
        ↓
SYNC_STATE
        ↓
overlay informa:
- playbackAttemptId atual
- lastReceivedSequence
- lastStartedSequence
- lastCompletedSequence
- IDs processados recentemente
        ↓
servidor compara com PostgreSQL
        ↓
RECONCILE
        ↓
Worker libera o próximo alerta elegível
```

## Ajustes recomendados no diagrama da arquitetura

1. Entre PostgreSQL/Prisma e Redis Streams, representar explicitamente:

   ```text
   Transactional Outbox
           ↓
   Outbox Publisher
           ↓
   Redis Streams
   ```

2. Mostrar que o consumo do Redis usa **Consumer Group** e que o ACK acontece somente após o processamento persistido.

3. Representar cada recibo pelo caminho:

   ```text
   Browser Source
         ↓
   Socket.IO Gateway
         ↓
   Prisma/PostgreSQL
         ↓
   Worker/Reconciliation
   ```

4. Adicionar o fluxo de reconexão e reconciliação:

   ```text
   Browser Source reconecta
           ↓
   SYNC_STATE
           ↓
   Gateway
           ↓
   PostgreSQL
           ↓
   RECONCILE
           ↓
   Worker
   ```

Materializar um evento da Outbox e despachar uma reprodução são operações diferentes. O Gateway deve persistir os recibos antes de o Worker tomar decisões. O fluxo `SYNC_STATE/RECONCILE` é essencial para o cenário em que o alerta tocou, mas a confirmação se perdeu.

## Regra final

- Sem `RECEIVED`: Worker e Redis Streams reenviam a mesma tentativa com o mesmo `playbackAttemptId`.
- Com `RECEIVED`, mas sem `STARTED`: primeiro reconciliar o estado do Browser Source.
- Depois de `STARTED`: não repetir automaticamente.
- Sem `COMPLETED` depois de `STARTED`: reconciliar e, persistindo a ambiguidade, enviar para `NEEDS_REVIEW`.
- OBS offline: manter o alerta `READY` no PostgreSQL.
- Redis reiniciado: reconstruir a fila a partir do PostgreSQL.
- Worker reiniciado: continuar retries usando `nextAttemptAt` persistido.
- Gateway reiniciado: reconectar o overlay e executar sincronização.
- Eventos de teste podem expirar.
- Eventos ligados a pagamentos confirmados permanecem recuperáveis.

A garantia não é `exactly once` absoluto, pois isso não pode ser assegurado em todos os cenários de quebra de conexão. A arquitetura deve usar **at-least-once delivery, processamento idempotente, ACKs por etapa e reconciliação de estado**, reduzindo ao máximo perdas e reproduções duplicadas.

> **Nenhum alerta pago deve desaparecer porque OBS, Redis, Worker, Gateway ou a conexão WebSocket ficaram temporariamente indisponíveis.**
