# Protocolo de execução do StreamOS

Estas regras valem para tarefas de desenvolvimento, revisão visual e validação neste repositório.

## Ciclos de trabalho

- Trabalhe em um único menu, página ou fluxo por ciclo.
- Para o redesenho, siga a ordem padrão: Widgets, Carteira e Configurações, salvo prioridade explícita do usuário.
- Cada ciclo deve terminar com uma alteração revisável, teste direcionado e commit próprio.
- Não repita uma auditoria geral quando o ciclo afetar somente uma área.
- Preserve alterações locais existentes e registre qualquer dependência entre ciclos.

## Uso de contexto e ferramentas

- Use `rg` ou `rg --files` antes de abrir arquivos.
- Leia somente os trechos necessários e limite a saída de comandos, builds, testes e diffs.
- Não carregue arquivos extensos, logs completos, suítes inteiras de screenshots ou diffs integrais sem necessidade comprovada.
- Para tarefas mecânicas, prefira a solução mais direta. Reserve raciocínio amplo para arquitetura, padrões visuais, falhas difíceis e revisão final.
- Consulte `docs/WORK_STATUS.md` no início de cada ciclo e atualize-o ao encerrar o ciclo.

## Validação

- Durante a implementação, execute apenas o teste relacionado à página ou componente alterado.
- Ao concluir um menu, valide seu fluxo correspondente.
- Execute build e suíte ampla apenas ao fechar um lote, quando uma mudança compartilhada justificar isso ou antes de staging.
- Durante ajustes visuais, valide uma resolução desktop e uma mobile.
- Valide as demais resoluções somente no fechamento do lote.
- Inspecione screenshots específicas, sem carregar todas simultaneamente.

## Registro e entrega

- Registre em `docs/WORK_STATUS.md`: ciclo atual, decisões vigentes, alterações locais, testes executados, resultado, limitações e próximo ciclo.
- Mantenha o registro curto. Substitua informações obsoletas em vez de acumular um diário extenso.
- No fim do ciclo, informe o commit, os testes executados e qualquer limite real da validação.
