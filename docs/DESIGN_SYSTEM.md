# Design system do StreamOS

Este documento registra os contratos visuais usados no painel. Mudanças de interface devem começar nos tokens e componentes compartilhados antes de criar uma exceção de página.

## Fundamentos

- **Contêiner:** conteúdo administrativo com largura máxima de `1280px`, alinhado ao início da área útil e centralizado quando houver espaço excedente.
- **Ritmo:** escala de 4, 8, 12, 16, 20, 24 e 32px. O espaço entre seções é maior que o espaço entre elementos da mesma seção.
- **Superfícies:** fundo da aplicação, superfície padrão, superfície elevada e superfície sutil. Bordas indicam agrupamento; sombras ficam reservadas para elementos flutuantes.
- **Tipografia:** Manrope em títulos e DM Sans em conteúdo. Títulos de página usam escala fluida e textos auxiliares têm pelo menos 12px.
- **Ações:** controles comuns têm 44px de altura. A ação principal aparece primeiro na leitura e ações destrutivas usam variante de perigo.

## Contratos dos componentes

### Cabeçalho de página

Use `PageHeader` ou a estrutura `.feature-header` com título, descrição e ações. A descrição não deve ultrapassar 70 caracteres por linha. Em telas estreitas, ações ocupam uma nova linha e podem preencher a largura disponível.

### Card de conteúdo

Use `Panel` ou `.feature-card` para agrupar uma tarefa. O card recebe título, descrição curta, conteúdo e ações. Estados vazio, carregando, erro e sucesso devem permanecer dentro da mesma área para evitar mudança brusca de layout.

### Formulários

Labels ficam acima dos campos. Ajuda e erro aparecem logo abaixo do campo relacionado. Campos usam elementos nativos, foco visível e área mínima de 44px. Grades passam para uma coluna conforme o conteúdo deixar de caber, sem depender de largura fixa.

### Ações

Botões de texto usam altura mínima de 44px; botões apenas com ícone usam 44 × 44px e nome acessível. Grupos quebram linha quando necessário. Em mobile, ações principais de formulários podem ocupar toda a largura.

### Estados

Estado não pode depender apenas de cor. Badges combinam texto e cor. Mensagens assíncronas usam `role="status"`; erros que exigem atenção usam `role="alert"`.

## Responsividade

- Até 900px, navegação lateral vira painel móvel e grades largas reduzem colunas.
- Até 640px, cabeçalhos e grupos de ações empilham, cards reduzem padding e tabelas usam contêiner com rolagem identificado.
- Validar sempre em 360px, 768px, 1366px e 1920px, além de zoom de 200% nas tarefas principais.

## Manutenção

Uma nova variação precisa representar diferença de função, prioridade ou estado. Ajustes recorrentes devem virar token ou contrato compartilhado. Exceções locais precisam permanecer no bloco da própria funcionalidade e não devem sobrescrever controles globais com `!important`.
