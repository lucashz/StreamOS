# Estado de trabalho do StreamOS

Atualizado em: 12/09/2026

## Ciclo atual

Fechamento do lote visual anterior. O próximo ciclo de produto deve tratar somente **Widgets**.

## Decisões vigentes

- Trabalhar em um menu, página ou fluxo por ciclo.
- Validar durante o ajuste em 1366 px e 360 px; usar 768 px e 1920 px somente no fechamento do lote.
- Executar testes direcionados durante o ciclo e build/suíte ampla somente no fechamento.
- Manter o Browser Source apenas em Configurações.
- Abrir os detalhes de uma contribuição em modal na mesma página.
- Manter formulários compactos e padrões compartilhados para alinhamento, espaçamento, botões, campos e cards.
- Preservar funções, regras financeiras, mensagens da API e nomes técnicos.

## Alterações locais pendentes

- Consolidação de tokens e componentes visuais em `apps/web/app/design-foundations.css` e `apps/web/app/design-components.css`.
- Ajustes nas páginas Widgets, Carteira, Configurações, início e onboarding.
- Browser Source movido da página inicial para Configurações.
- Revisão automatizada adicionada em `tests/browser/design-review.spec.ts`.
- Prompt e critérios do lote registrados em `docs/REDESIGN_EXECUTION.md`.

Essas alterações pertencem ao lote visual anterior e ainda precisam de validação final e commit conjunto antes do próximo ciclo.

## Validações já registradas

- Fluxo contribuição → pagamento mock → evento em tempo real: aprovado.
- Fluxo carteira → recebível: aprovado.
- Saque: bloqueado pela configuração local `PAYOUTS_ENABLED=false`; nenhuma execução de saque foi validada.
- Fluxo vaquinha → contribuição → progresso, recompensas e isolamento entre organizações: aprovado.
- Revisão visual automatizada: Widgets, Carteira e Configurações exercitados em 360, 768, 1366 e 1920 px antes dos últimos ajustes menores.

## Próxima ação

1. Formatar e compilar o lote visual pendente.
2. Executar o teste visual direcionado em 1366 px e 360 px.
3. Corrigir somente regressões encontradas nessas telas.
4. Criar o commit de fechamento do lote.
5. Iniciar um novo ciclo exclusivo para Widgets.
