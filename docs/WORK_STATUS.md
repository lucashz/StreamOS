# Estado de trabalho do StreamOS

Atualizado em: 13/10/2026

## Ciclo atual

Onboarding validado em 13/10/2026 nos quatro estados reais em 360 px e 1366 px; validação das páginas públicas e estados do Pix é o próximo ciclo.

## Decisões vigentes

- Trabalhar em um menu, página ou fluxo por ciclo.
- Validar durante o ajuste em 1366 px e 360 px; usar 768 px e 1920 px somente no fechamento do lote.
- Executar testes direcionados durante o ciclo e build/suíte ampla somente no fechamento.
- Manter o Browser Source apenas em Configurações.
- Abrir os detalhes de uma contribuição em modal na mesma página.
- Manter formulários compactos e padrões compartilhados para alinhamento, espaçamento, botões, campos e cards.
- Preservar funções, regras financeiras, mensagens da API e nomes técnicos.

## Lote visual fechado

- Consolidação de tokens e componentes visuais em `apps/web/app/design-foundations.css` e `apps/web/app/design-components.css`.
- Ajustes nas páginas Widgets, Carteira, Configurações, início e onboarding.
- Browser Source movido da página inicial para Configurações.
- Revisão automatizada adicionada em `tests/browser/design-review.spec.ts`, com conteúdo longo, modal, carregamento, erro e verificação de overflow.
- Prompt e critérios do lote registrados em `docs/REDESIGN_EXECUTION.md`.

## Validações já registradas

- Convites/E2E (06/10/2026): `test:e2e:alerts`, `test:e2e:campaigns`, `test:e2e:subscriptions`, `test:e2e:songpix`, `test:e2e:videopix`, `test:e2e:platform` e `test:e2e:alert-reliability` aprovados com a criação de `BetaInvite` restrita aos utilitários de teste.
- Carga de alertas (06/10/2026): repetição isolada aprovou 100 pagamentos, 100 entregas, zero perdas e zero reprodução duplicada. A primeira execução, imediatamente após sete E2Es, teve um HTTP 500 isolado e não reproduzido.
- Carga de readiness (06/10/2026): repetição isolada aprovou 500 requisições, concorrência 25, zero falhas e p95 de 32,25 ms. A primeira execução no lote atingiu 1003,73 ms e excedeu o limite de 500 ms.
- Resiliência (06/10/2026): indisponibilidade controlada e recuperação de Redis e PostgreSQL aprovadas.
- Decisão de cobertura: `load-beta` exercita somente readiness e `resilience-beta` somente falha/recuperação da infraestrutura; cenário de convite nesses scripts não acrescentaria cobertura. `load-paid-alerts` já cadastra a conta com convite sob carga, e as regras do convite serão validadas diretamente via API no ciclo seguinte.
- Convites/API (06/10/2026): `test:e2e:accounts` rejeitou código inválido, rejeitou e-mail divergente sem consumir o convite, rejeitou reutilização e confirmou o cookie de sessão em `GET /auth/me` imediatamente após o cadastro.
- Convites/manual: pendente de uma sessão de navegador interativa compartilhada. A automação Playwright não será usada como substituta para este item.

- Carteira: carregamento movido para um bloco neutro alinhado ao conteúdo; notificações voltaram ao tamanho compacto e o estado foi validado em 360 e 1366 px.
- Carteira: alerta financeiro compacto, contexto de saldo e destino no saque, extrato em grade estável e retorno visual de erro/sucesso revisados em 360 e 1366 px.
- Central da Live: aviso de fila extensa quando a espera estimada alcança 15 minutos ou 100 alertas; os pagamentos permanecem preservados e as ações existentes de pausar e reorganizar continuam disponíveis.
- Fluxos pagos: Vaquinha, SongPix e VideoPix comprovam um Payment, um JournalEntry com quatro postings e um item de fila; assinaturas continuam mock, com renovação idempotente e fila única, sem cobrança recorrente no ledger.
- Contribuições: o rastreamento visual termina em “Enviado ao overlay”; o estado de reprodução permanece interno e o botão de fechar do modal foi alinhado e validado em 360 e 1366 px.
- Widgets: superfícies, bordas, textos secundários, estados ativo/inativo, foco e seleção agora usam papéis semânticos locais e consistentes.
- Widgets: cards gerenciados, resumo, chamada de alertas e catálogo validados visualmente em 1366 e 360 px, sem overflow horizontal.
- Web: typecheck e lint direcionados aprovados; o teste visual combinado avançou por Widgets e falhou posteriormente em Conta por dados de perfil ausentes.

- Fluxo contribuição → pagamento mock → evento em tempo real: aprovado.
- Fluxo carteira → recebível: aprovado.
- Saque: bloqueado pela configuração local `PAYOUTS_ENABLED=false`; nenhuma execução de saque foi validada.
- Fluxo vaquinha → contribuição → progresso, recompensas e isolamento entre organizações: aprovado.
- Build do frontend: aprovado em 12/09/2026.
- Revisão visual automatizada final: Widgets, Carteira e Configurações aprovados em 360 e 1366 px, com inspeção das capturas.
- Revisão complementar anterior: 768 e 1920 px aprovados antes dos últimos ajustes menores.
- Widgets: cards, catálogo, estados e editor aprovados em 360 e 1366 px.
- Widgets/OBS: catálogo completo, ativação, configuração versionada, teste com mídia, entrega em tempo real, QR público, rotação de token, duplicação, exclusão e isolamento entre organizações aprovados.
- Editor mobile: removida a ação duplicada do cabeçalho para preservar a leitura de títulos longos; a ação permanece no rodapé fixo.
- Carteira: recebíveis, extrato, histórico e controles expansíveis aprovados em 360 e 1366 px.
- Carteira: chave Pix protegida e recebível mock de R$ 200,00 conciliado em R$ 188,40 líquidos.
- Saque mock não executado porque `PAYOUTS_ENABLED=false`; o teste confirmou que o kill switch bloqueia a operação.
- Configurações: Conta, Equipe, Integrações, API/Webhooks e Saúde aprovados em 360 e 1366 px.
- Browser Source: geração da URL protegida validada dentro de Configurações; envio de teste fica habilitado após a configuração.
- Layout das telas administrativas validado sem overflow horizontal nos dois tamanhos do ciclo.
- Fechamento responsivo: revisão visual aprovada automaticamente em 360, 768, 1366 e 1920 px.
- Fluxo contribuição → pagamento mock → evento/reprodução do alerta: aprovado com reconciliação.
- Fluxo carteira → recebível: aprovado; saque segue não executado com `PAYOUTS_ENABLED=false` e bloqueio confirmado.
- Fluxo vaquinha → contribuição → progresso: checkout público, atualização em tempo real, recompensa e isolamento aprovados.
- Build completo do monorepo: aprovado.
- Suíte ampla do navegador: 58 testes aprovados, 6 ignorados por condições previstas e nenhuma falha.
- Performance: gráfico alimentado pelos pagamentos confirmados dos últimos 30 dias, com seleção funcional de 7/30 dias, totais e datas reais.
- Contribuições: linhas do extrato com fundo neutro, hover discreto e versão mobile em card.
- Salvamento: aviso da Conta alinhado, centralizado e contido na viewport em desktop e mobile.
- Central da Live: ordenação, movimentação, pausa/retomada, volume, modos de fila, replay, sessões, bloqueio, histórico paginado, CSV e isolamento aprovados.
- Alertas, SongPix e VideoPix: reprodução e descarte automático aprovados; estado sem OBS mantém a fila persistida.
- Central mobile: cabeçalho do histórico alinhado ao eixo do conteúdo.
- Latência: entregas de webhooks externos agora são processadas em paralelo e não bloqueiam sequencialmente o ciclo que publica alertas no OBS.
- Fluxo local completo medido em 4,1 segundos após a correção, sem regressão na fila durável.
- Somente alertas de teste expiram após 90 segundos; todos os alertas vinculados a pagamentos permanecem duráveis enquanto o OBS estiver offline.
- Watchdog de alertas imediatos limitado a 30 segundos para liberar itens sem recibo final do overlay.
- Avanço automático centralizado no worker; o realtime não pode mais ignorar expiração, presença do OBS ou o limite de 30 segundos.
- Auditoria da fila registrada em `docs/ALERT_QUEUE_AUDIT.md`; especificação incorporada ao repositório.
- `LiveQueueItem` recebeu sequência imutável por organização e vínculo opcional ao pagamento; `PlaybackAttempt` persiste tentativas e backoff sem criar outra fila.
- Materialização duplicada removida da API; o worker é o único responsável por criar itens a partir da Outbox.
- Worker cria `PlaybackAttempt` atomicamente com o evento de reprodução para alertas, SongPix e VideoPix; Gateway liga entrega e recibos à tentativa.
- Browser Source persiste o estado por `playbackAttemptId` e não reinicia uma tentativa conhecida após refresh ou reconexão.
- Carga de 100 pagamentos com concorrência 20: 100 alertas entregues, zero perdidos e zero duplicados; relatório em `docs/LOAD_TEST_PAID_ALERTS.md`.
- Tentativas sem recibo usam o mesmo `playbackAttemptId` nos intervalos persistentes de 2, 5, 10 e 30 segundos; depois seguem para `NEEDS_REVIEW`.
- Depois de `RECEIVED`, a fila aguarda até 10 segundos pelo início e não reproduz novamente; depois de `STARTED`, usa a duração real da mídia mais 15 segundos.
- Reconexões sincronizam o estado local antes de receber novos eventos. Reprodução iniciada sem conclusão confirmada vai para revisão e nunca reinicia automaticamente.
- Central da Live exibe tentativa, quantidade de envios e último erro, com ações auditadas para tentar novamente, marcar como reproduzido, pular e cancelar.
- Teste de falhas aprovado para perda antes de `RECEIVED`, reconexão depois de `STARTED`, repetição manual com nova tentativa, OBS offline e reinício do Redis.
- Concorrência com dois workers e 20 pagamentos: 20 concluídos, zero perdas e zero reproduções duplicadas; uma reentrega técnica foi absorvida pela idempotência.
- Apenas um Browser Source pode ficar ativo por canal: a conexão nova substitui a anterior de forma serializada e a entrega usa somente o `connectionId` eleito.
- Reinício do Worker antes de `RECEIVED` preserva e reenvia a mesma tentativa; reinício do Gateway depois de `STARTED` reconcilia para revisão sem repetir a mídia.
- Central da Live separa alertas incertos do histórico, mostra o motivo do bloqueio, tentativa, número de envios e quatro ações operacionais com texto claro.
- O card de reprodução mostra sempre o próximo alerta, apoiador, valor e duração; conteúdo longo usa truncamento controlado e o layout passa para uma coluna no celular.
- Confirmação financeira concorrente, ordenação dos recibos e starvation causada por backlogs offline foram corrigidas durante a carga.
- Reprodução automática e remoção visual do alerta aprovadas no navegador; controle completo da fila aprovado no teste E2E.
- Moderação: política automática antes da cobrança e TTS automático aprovados.
- Voz e TTS: limites de 0 reais e 1–500 caracteres refletidos no formulário; salvamento bloqueia ações concorrentes e informa sucesso ou falha.
- Políticas: palavras vazias são rejeitadas no cliente e falhas de criação recebem retorno visível.
- Página pública: contribuição, pagamento mock, confirmação, reconciliação e alerta aprovados.
- Vaquinha: checkout público, concorrência da última recompensa, progresso em tempo real, entrega e isolamento aprovados.
- Assinaturas: benefícios, overlay, renovação idempotente, falha, cancelamento, histórico e isolamento aprovados.
- SongPix: validação de gênero, checkout, fila, reprodução automática e recibo do overlay aprovados.
- VideoPix: metadados, preço por segundo, checkout, player, indisponibilidade posterior e isolamento aprovados.
- Página pública aprovada visualmente por automação em 360 e 1366 px com nome e mensagem longos.
- Editor de alertas: o cliente de teste agora responde à sincronização exigida pelo Browser Source antes de solicitar um alerta; entrega direcionada, mídias e atualização ao vivo aprovadas.
- Fechamento operacional: moderação, carteira, fila resiliente e fluxo local completo aprovados; este último confirmou um Payment, quatro lançamentos contábeis e apenas um item de fila.
- Conta: atualização de perfil não retorna mais campos `BigInt` do domínio; perfil, sessões, senha, recuperação e isolamento entre contas aprovados.
- Widgets/OBS: os testes de entrega agora sincronizam o Browser Source antes de solicitar eventos; catálogo, mídia, QR Code, rotação de token e isolamento aprovados.
- Plataforma: RBAC, rotação de token bearer, assinatura e histórico de webhooks e isolamento aprovados.
- Onboarding (13/10/2026): os quatro estados derivados de dados reais (perfil incompleto, perfil salvo não publicado, publicado sem conexão OBS e OBS conectado com transição para Central da Live) validados via Playwright em 360 px e 1366 px sem overflow.
- Fechamento visual: suíte Playwright aprovada com 72 cenários responsivos; o replay do histórico confirma o estado intermediário `QUEUED` e a nova reprodução no Browser Source.

## Próxima ação

1. Validar páginas públicas (criador inexistente, perfil não publicado, SongPix/VideoPix desativados, vaquinha encerrada) e estados do Pix (aguardando e expirado) em 360 px e 1366 px.
2. Validar código de convite via fluxo manual em sessão de navegador interativa compartilhada quando disponível.
3. Provisionar staging com domínios, segredos e credenciais reais fora do repositório; somente então executar migração limpa, `preflight:staging` e `smoke:staging`.
