# Teste de carga da fila de alertas pagos

Executado em: 14/09/2026

## Cenário final

- 100 contribuições criadas e confirmadas.
- Concorrência de confirmação: 20.
- Um Browser Source autenticado com heartbeat a cada 15 segundos.
- Recibos `RECEIVED`, `STARTED` e `COMPLETED` para cada tentativa.
- Verificação de perda e duplicidade por `playbackAttemptId`.

## Resultado

| Métrica | Resultado |
| --- | ---: |
| Alertas esperados | 100 |
| Alertas recebidos | 100 |
| Alertas perdidos | 0 |
| Tentativas duplicadas | 0 |
| p95 da criação da intenção | 248 ms |
| p95 da confirmação do pagamento | 3.473 ms |
| p50 pagamento → reprodução | 68.411 ms |
| p95 pagamento → reprodução | 110.458 ms |
| Tempo até o último alerta | 115.339 ms |

## Falhas encontradas e corrigidas

1. Confirmações concorrentes disputavam a criação das contas contábeis e podiam
   retornar HTTP 500. A criação passou a usar `createMany` idempotente com
   `skipDuplicates`, seguida da leitura das contas persistidas.
2. Recibos enviados em sequência rápida podiam ser processados fora de ordem. O
   Gateway agora serializa recibos do mesmo evento com advisory lock no
   PostgreSQL e rejeita regressões de estado.
3. A consulta global dos primeiros 100 itens permitia que organizações offline
   ocupassem a janela e bloqueassem organizações online. A seleção agora filtra
   heartbeat ativo antes de aplicar o limite.
4. O simulador inicial não renovava heartbeat. O teste passou a reproduzir o
   comportamento real do Browser Source.

## Reexecução

```powershell
$env:ALERT_LOAD_TOTAL='100'
$env:ALERT_LOAD_CONCURRENCY='20'
$env:ALERT_LOAD_TIMEOUT_MS='240000'
corepack pnpm test:load:paid-alerts
```
