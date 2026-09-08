# Validação de widgets e overlay

## Gate de aprovação

Uma versão só pode ser aprovada quando todos os itens críticos abaixo passam em desktop, mobile e Browser Source do OBS. Qualquer alerta duplicado, evento no overlay incorreto, mídia persistente depois de concluída ou configuração divergente bloqueia a entrega.

## Matriz funcional

| Área | Cenários obrigatórios | Resultado esperado |
| --- | --- | --- |
| Catálogo | listar tipos predefinidos, criar, ativar, desativar, editar e excluir | estado persistente e coerente em `/widgets` e `/alertas` |
| URL do OBS | copiar, ocultar, rotacionar token e revogar URL antiga | URL nova funciona; URL antiga retorna 404 |
| Overlay ocioso | abrir e reconectar sem evento | canvas transparente, vazio e sem áudio |
| Alertas | texto, áudio gravado, TTS, anônimo, valores e mensagens longas | um único alerta, dados e duração corretos |
| Variação | faixa de valor, prioridade, padrão, template, posição, cores, fonte e visibilidade | seleção determinística e fiel à configuração salva |
| Mídia do alerta | imagem, GIF, vídeo, som, volume, falha e fallback | mídia disponível no OBS; falha não trava a fila |
| VideoPix | trecho, início/fim, pausar, continuar, reiniciar, pular e concluir | somente overlay VideoPix; nunca alerta genérico de R$ 0 |
| SongPix | abertura, transição compacta, som, volume, pausar, continuar, reiniciar e concluir | somente overlay SongPix; layout central e compacto íntegros |
| Widgets fixos | QR Code, meta, maratona, ranking, últimos apoios, enquete, banner e texto | configuração e dados iniciais corretos |
| Fila | FIFO, valor, equilibrada, mover, avanço automático e fila pausada | ordem persistente e apenas um item tocando |
| Histórico | concluir, pular, bloquear, repetir e exportar CSV | estado e ação auditáveis, sem novo pagamento |
| Realtime | desconectar/reconectar API, realtime e OBS | eventos não somem nem são duplicados |
| Segurança | token inválido, widget desativado, organização diferente e arquivo inválido | acesso negado sem vazamento entre organizações |

## Isolamento obrigatório de eventos

- `ALERT`, `AUDIO` e `TTS` podem ser renderizados pelo widget Alertas.
- `SONG_PIX` é exclusivo do widget SongPix.
- `VIDEO_PIX` é exclusivo do widget VideoPix.
- Assinaturas e campanhas usam seus widgets próprios.
- Um evento especializado nunca pode gerar o fallback `Apoiador · R$ 0,00`.
- Eventos já reconhecidos não podem reaparecer após reconexão.

## Formatos visuais

- OBS 1920 × 1080 (16:9).
- Vertical 1080 × 1920 (9:16).
- Quadrado 1080 × 1080 (1:1).
- Dock estreito e viewport móvel.
- Texto longo, nome longo, ausência de imagem e imagem extrema.
- Nenhum overflow horizontal, corte de controles ou fundo opaco quando ocioso.

## Evidências mínimas

- Saída dos testes unitários da API, realtime e overlay.
- Saída dos E2E de widgets, alertas, fila, SongPix e VideoPix.
- Playwright desktop e mobile.

## Regressão executada em 2026-09-01

| Cenario | Estado | Evidencia |
| --- | --- | --- |
| Replay do historico com fila pausada | Aprovado | E2E de fila e Playwright com overlay conectado |
| Reinicio do player YouTube | Aprovado em codigo | iframe recriado por evento e comando `seekTo`; testes para musica pausada/ativa e inicio do trecho de video |
| Prazo de replay SongPix/VideoPix | Aprovado | duracao real da midia mais margem de 15 segundos |
| Fila, pausa, retomada, ordem, replay e historico | Aprovado | `tools/e2e-live-control.mjs` |
| Todos os 14 tipos do catalogo | Aprovado | `tools/e2e-widgets.mjs` |
| Ativar e desativar widget | Aprovado | API, URL publica, Playwright desktop e mobile |
| Configuracao, variacao, uploads e atualizacao ao vivo | Aprovado | `tools/e2e-alert-editor.mjs` |
| SongPix | Aprovado em PSP simulado | checkout, duplicadas, realtime, autoplay e conclusao pelo overlay |
| VideoPix | Aprovado em PSP simulado | metadados, preco, checkout, realtime e indisponibilidade |
| Pagamento ate overlay e conciliacao | Aprovado em PSP simulado | `tools/e2e-vertical.mjs` |
| Overlay ocioso, responsividade e isolamento | Aprovado | Playwright em 360, 768, 1366 e 1920 px |
| Fontes separadas de alerta, música e vídeo | Aprovado | política realtime, E2E de widgets e Playwright por canal dedicado |
| Templates prontos e persistência após reload | Aprovado | Playwright seleciona Card clássico, verifica preset, salva e recarrega |
| Simulação local com Woovi configurada | Aprovado | cobrança `local_sim`, confirmação, fila, ACK, ledger e conciliação local |
| Inicialização local completa | Aprovado | `local:start`, `local:status`, readiness da API e liveness de realtime, overlay e web |
| Saida sonora fisica no OBS | Validacao manual pendente | a automacao confirma comandos e estados, mas nao mede o dispositivo de audio |
| Vozes neurais de terceiros | Nao implementado | exige provedor e licenciamento; as vozes atuais usam Speech Synthesis local |

Um item dependente de audio fisico nao deve ser declarado concluido antes da
confirmacao no mixer do OBS.
- Capturas dos três formatos do overlay para alerta, música e vídeo.
- Registro das falhas encontradas, correção aplicada e regressão repetida.
