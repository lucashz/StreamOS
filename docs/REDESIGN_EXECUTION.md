# Prompt de execução e critérios de revisão

Audite e ajuste o StreamOS, começando por Widgets, Carteira e Configurações. Preserve nomes técnicos, valores, regras financeiras e mensagens da API. Respeite as decisões já tomadas: Browser Source em Configurações, contribuição em modal na mesma página, resumo de Widgets sem indicadores de conexão ou atenção e formulários compactos.

1. Leia o código, contratos visuais e testes existentes. Registre evidências antes de concluir que uma tela está correta. Preserve alterações locais.
2. Use contas locais de teste e dados persistidos pela API para preencher widgets, contribuições e históricos. Inclua nomes e mensagens longos. Simule falhas e atrasos somente no navegador de teste. Não execute operações financeiras reais.
3. Revise hierarquia, alinhamento, largura, altura útil, quebra de texto, botões, campos, navegação, modais, foco e retorno das ações em 360, 768, 1366 e 1920px. Capture os estados para revisão do proprietário. Aprovação automática não substitui aprovação visual humana.
4. Consolide as regras compartilhadas numa fonte identificável. Remova CSS desativado e duplicações comprovadas. Preserve a ordem de cascata que ainda tenha dependências e explique exceções. Corrija componentes compartilhados antes de criar novos ajustes locais.
5. Execute contribuição → confirmação mock → evento/reprodução do alerta; carteira → recebíveis → liberação → saque mock; vaquinha → contribuição → progresso. Verifique persistência, isolamento de organização e idempotência quando os testes existentes cobrirem esses contratos.
6. Compile, atualize o ambiente local e rode os testes relevantes. Revise capturas desktop/mobile. Documente resultados, falhas resolvidas e limites reais da cobertura. Entregue links para as capturas e deixe a aprovação visual explicitamente pendente do usuário.

## Aceitação

- Nenhum overflow da página nos cenários exercitados; tabelas podem rolar dentro de seu próprio contêiner.
- Textos longos não encobrem ações; modais permanecem alcançáveis e fecham corretamente.
- Atrasos e erros preservam retorno visível, sem apresentar sucesso inexistente.
- Campos e ações de uma mesma tarefa compartilham eixo e medidas.
- Fonte compartilhada de estilos identificada; CSS inativo removido.
- Resultados dos três fluxos registrados, distinguindo sandbox de OBS real.
- Capturas fornecidas para avaliação humana, sem declarar aprovação em nome do usuário.
