# Auditoria de interface e funções do StreamOS

Data: 8 de setembro de 2026  
Roteiro: [`UI-AUDIT-PROMPT.md`](UI-AUDIT-PROMPT.md)

## Resultado

A varredura autenticada percorreu 25 destinos em quatro viewports, totalizando 100 combinações após a consolidação do menu. Não houve overflow horizontal, erro HTTP, erro de console ou âncora inválida na segunda execução. As capturas e os dados brutos ficam em `.runtime/ui-audit/` e não são versionados por conterem estado local.

Viewports verificadas:

- 360 × 800
- 768 × 1024
- 1366 × 768
- 1920 × 1080

## Cobertura por grupo

| Grupo             | Destinos verificados                                                | Resultado                                        |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| Visão geral       | Painel                                                              | Aprovado nos quatro tamanhos                     |
| Receitas          | Contribuições, Carteira, Vaquinhas, Recompensas e Assinaturas       | Aprovado; destino de Recompensas corrigido       |
| Transmissão       | Central da Live, Alertas, Widgets e Aparência                       | Aprovado nos quatro tamanhos                     |
| Comunidade        | Moderação, Voz e TTS e Bloqueios                                    | Aprovado; destinos de TTS e Bloqueios corrigidos |
| Configurações     | Perfil, Equipe, Integrações, API, Webhooks, Segurança e Minha conta | Aprovado; item redundante Conexões removido      |
| Fluxos auxiliares | Criação de widget, Metas, Onboarding, Saúde e Dock                  | Aprovado nos quatro tamanhos                     |

## Moderação, box por box

| Box                        | Verificação                                                | Resultado                                |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Aviso financeiro           | Leitura, contraste, largura e quebra de texto              | Aprovado                                 |
| Configuração               | Checkboxes, campos monetário/numérico, grid e botão Salvar | Aprovado; âncora `#tts` adicionada       |
| Políticas                  | Campo de palavras, ação e lista persistida                 | Aprovado; âncora `#bloqueios` adicionada |
| Sinalizados durante a live | Estado vazio, texto explicativo e lista de revisão         | Aprovado                                 |
| Histórico automático       | Estado vazio e linhas de decisão                           | Aprovado                                 |

No desktop, os três controles de configuração permanecem em uma linha e os dois campos numéricos ocupam colunas proporcionais. No tablet, o grid passa para duas colunas. No mobile, todos os controles usam uma coluna e os boxes mantêm margens e larguras consistentes.

## Regressão funcional executada

| Fluxo                   | Evidência                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Jornada vertical        | Pagamento mock, ledger, outbox, overlay, saldo e conciliação aprovados                     |
| Contas                  | Sessões, perfil, isolamento, troca e recuperação de senha aprovados                        |
| Carteira                | Identidade financeira, chave Pix protegida, recebíveis e kill switch de saques aprovados   |
| Moderação               | Política pré-cobrança, política automática e TTS automático aprovados                      |
| Widgets                 | 14 tipos, ativação, configuração, mídia, realtime, token, duplicação e exclusão aprovados  |
| SongPix e VideoPix      | Validação anterior ao pagamento, checkout, fila, overlay e isolamento aprovados            |
| Campanhas e assinaturas | Checkout, concorrência, benefícios, renovação e cancelamento aprovados                     |
| Plataforma              | RBAC, tokens, HMAC, histórico de webhook e isolamento aprovados                            |
| Central da Live         | Ordem, pausa, volume, reprodução, replay, sessão, moderação e CSV aprovados                |
| Alertas                 | Variações, aparência, uploads, prévia, overlay, atualização e versionamento aprovados      |
| Navegador               | 26 testes aprovados e 6 ignorados intencionalmente por serem exclusivos do projeto desktop |

## Correções aplicadas durante a auditoria

1. Adicionadas as âncoras `#tts`, `#bloqueios` e `#recompensas`, com margem de rolagem para o cabeçalho móvel.
2. Removido o item `Conexões`, que duplicava Integrações e apontava para uma seção inexistente.
3. Atualizado o E2E da carteira para concluir a identidade financeira antes da chave Pix e validar o kill switch quando saques estão desabilitados.
4. Removida uma condição de corrida no E2E de webhooks: o teste agora aguarda o worker persistir o estado `DELIVERED`.
5. Criado `tools/audit-ui.mjs` para repetir a matriz de páginas, viewports, capturas e verificações estruturais.

## Pendências manuais

- Confirmar áudio, pausa e reinício no mixer de uma instalação real do OBS.
- Verificar gravação por microfone com permissão real do navegador.
- Repetir a inspeção visual com uma organização antiga e bastante conteúdo para cobrir tabelas, nomes, URLs e históricos longos.
- Executar uma rodada assistida com usuário externo para avaliar compreensão, ordem das ações e linguagem; as verificações atuais cobrem funcionamento e consistência, não usabilidade observada.
