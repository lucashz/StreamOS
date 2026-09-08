# Prompt de auditoria visual e funcional do StreamOS

## Papel

Atue como responsável por qualidade de produto, design de interface e experiência do streamer. Audite o StreamOS como um produto real prestes a entrar em beta. Não aprove uma tela apenas porque ela carrega: verifique clareza, consistência, acabamento e funcionamento.

## Escopo

Percorra todos os grupos e itens do menu lateral, incluindo destinos com âncora. Audite também autenticação, onboarding, páginas públicas, criação de widgets e o dock da Central da Live. Comece pela página de Moderação e revisite cada função disponível.

Execute a auditoria em 1366 × 768, 1920 × 1080, 768 × 1024 e 360 × 800. Considere conteúdo vazio, conteúdo preenchido, textos longos, carregamento, sucesso, erro e acesso sem sessão quando aplicável.

## Verificação por tela

1. Confirme título, descrição, ação principal, estado ativo do menu e correspondência entre o nome do menu e o conteúdo.
2. Examine cada box: alinhamento, largura, altura, espaçamento, padding, borda, raio, hierarquia, densidade e equilíbrio com os boxes vizinhos.
3. Compare colunas e grids. Procure boxes desalinhados, alturas artificiais, áreas vazias excessivas, controles espremidos e mudanças bruscas de largura.
4. Detecte overflow horizontal, conteúdo cortado, sobreposição, botões fora da viewport, texto truncado sem explicação e elementos que ultrapassam o próprio container.
5. Verifique responsividade do menu, cabeçalho, tabelas, formulários, modais, abas, filtros, cards e barras de ação.
6. Acione botões, links, toggles, filtros, abas, formulários e ações de copiar. Confirme feedback de carregamento, sucesso, erro, estado desabilitado e persistência após recarregar.
7. Registre erros de console, respostas HTTP 4xx/5xx inesperadas, links sem destino e controles sem efeito observável.
8. Verifique linguagem, acentuação, consistência dos nomes, valores monetários, datas, estados vazios e mensagens de orientação.
9. Na Moderação, examine separadamente configurações gerais, TTS, políticas/bloqueios, fila de revisão, decisões e estados vazios. Confirme que as âncoras do menu levam à seção correta e marcam o item correto.
10. Não faça julgamento apenas por captura: relacione cada problema visual ao impacto prático e à regra funcional esperada.

## Registro

Para cada achado, informe rota, viewport, seção/box, evidência, comportamento esperado, comportamento observado e severidade:

- P0: impede uso, causa perda financeira, vazamento ou ação perigosa.
- P1: função principal quebrada, conteúdo inacessível ou layout inutilizável.
- P2: problema claro de consistência, responsividade ou feedback.
- P3: polimento visual ou textual sem bloquear a tarefa.

Não liste preferências subjetivas sem evidência. Agrupe causas repetidas e identifique o componente ou regra CSS compartilhada. Ao final, produza uma matriz de cobertura e um backlog ordenado por severidade e alcance.

## Critério de conclusão

A auditoria termina quando todos os destinos do menu foram abertos nos quatro tamanhos, os principais controles foram exercitados, a Moderação foi revisada box por box e cada falha tem evidência reproduzível ou foi descartada após inspeção.
