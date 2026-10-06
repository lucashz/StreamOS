# Revisão de prontidão para beta fechada

## Objetivo

Preparar o StreamOS para uma beta fechada sem assumir que as telas atuais, os
fluxos de ativação ou os pagamentos já estão prontos. Cada jornada deve ser
classificada e receber correção somente quando houver evidência de uma lacuna.

O sucesso da revisão é um criador convidado conseguir criar a conta, configurar
a página, conectar o OBS, receber uma contribuição de teste e entender o
registro financeiro sem suporte individual. Nenhum pagamento confirmado pode
ser duplicado, perdido ou ficar sem estado rastreável.

## Escopo da revisão

### 1. Entrada e identidade

- Página inicial: proposta de valor, CTA, confiança, FAQ, links legais e estado
  para visitante autenticado.
- Cadastro, entrada, recuperação e redefinição de senha: validação, mensagens,
  sessão, acessibilidade e mobile.
- Convites: o desenho da beta deve escolher entre lista explícita de criadores
  convidados ou cadastro aberto; não será implementado antes dessa decisão.

### 2. Ativação do criador

- Onboarding: perfil, slug, publicação, dados de carteira/sandbox, primeiro
  alerta e Browser Source.
- Início: pendências que levam a uma ação concreta, conexão do OBS e resumo
  sem métricas ou controles internos desnecessários.
- Conta, equipe, integrações, API/Webhooks e saúde: permissões, formulários,
  estados de sucesso/erro e encerramento de sessão.

### 3. Experiência pública

- Página do criador e contribuição comum: identidade, valor, mensagem,
  pagamento, confirmação e falhas.
- Vaquinha, assinatura, SongPix e VideoPix: disponibilidade, preço, conteúdo
  longo, cancelamento/indisponibilidade e retorno após pagamento.
- URLs públicas: criador inexistente, conteúdo despublicado, token inválido e
  navegador mobile.

### 4. Operação durante a live

- Widgets, Tema global, Alertas e variações, Central da Live, Moderação e Voz
  e TTS.
- OBS offline, conexão substituída, atualização do Browser Source, fila longa,
  pausa, reordenação, item incerto e ações manuais.
- Alertas pagos devem preservar o mesmo pagamento e tentativa até conclusão,
  revisão ou ação manual auditada.

### 5. Finanças e suporte

- Contribuições, carteira, recebíveis, extrato, conciliação e saque.
- Valores bruto, taxas, líquido e estados financeiros devem concordar entre
  páginas e API.
- Saque real permanece fora da beta até existir provedor homologado,
  `PAYOUTS_ENABLED` e credenciais de ambiente.
- Ferramentas de suporte devem permitir consultar pagamento, outbox e canais do
  overlay sem expor segredos ao criador.

### 6. Operação de ambiente

- Variáveis de ambiente, migrations em banco limpo, armazenamento de mídia,
  e-mail, URLs públicas, domínio, HTTPS e CORS.
- Preflight, smoke test, backup/restauração e plano de incidente para webhook,
  pagamento e fila.
- A configuração atual ainda não possui `.env.staging`; staging não é elegível
  até que esse arquivo e as credenciais necessárias existam.

## Método

Cada página ou fluxo recebe uma ficha curta com cinco avaliações:

| Critério    | Pronto quando                                                 |
| ----------- | ------------------------------------------------------------- |
| Funciona    | A jornada termina sem intervenção manual.                     |
| Entende     | Próxima ação, valores e estado ficam claros.                  |
| Recupera    | Erro não perde dados e oferece uma ação possível.             |
| Valida      | Há teste automatizado ou roteiro manual reproduzível.         |
| Libera beta | Não depende de configuração, credencial ou correção pendente. |

O resultado de cada ficha é `PRONTO`, `PENDENTE` ou `BLOQUEADOR`. Um
`BLOQUEADOR` tem evidência, impacto, responsável pelo ciclo e teste de saída.
Não haverá redesign geral: mudanças visuais entram apenas quando impedirem
compreensão, consistência ou uso em desktop/mobile.

## Ordem dos ciclos

1. **Auditoria de jornadas e inventário de bloqueadores.** Percorrer todas as
   páginas e estados com dados reais ou controlados; criar a matriz de
   prontidão e selecionar os bloqueadores verificáveis.
2. **Confiabilidade financeira e alertas.** Tratar somente lacunas comprovadas
   em criação, confirmação, ledger, fila, recibos e recuperação.
3. **Cadastro e ativação.** Fechar os pontos que impedem um criador de chegar
   sozinho à primeira contribuição e ao primeiro alerta no OBS.
4. **Experiência pública.** Corrigir entrada, página do criador e confirmação
   de pagamento, priorizando clareza e erro recuperável.
5. **Operação do criador.** Revisar painel, carteira, Central, widgets,
   moderação e configurações com listas vazias, extensas e falhas.
6. **Staging da beta.** Preparar ambiente, executar preflight/smoke e decidir
   se os bloqueadores foram eliminados.

Cada ciclo altera uma única jornada, executa testes direcionados, atualiza
`docs/WORK_STATUS.md` e cria um commit próprio. Build e suíte ampla ficam para
o fechamento de cada lote, não para cada correção.

## Fora de escopo

- Lançamento público e marketing de aquisição.
- Saques reais sem homologação do provedor.
- Nova arquitetura de observabilidade.
- Novos recursos que não resolvam um bloqueador de beta confirmado.

## Critérios de entrada da beta

- Não há bloqueador aberto nas jornadas de cadastro, onboarding, contribuição
  comum, carteira, alerta/OBS e recuperação de falha.
- Os fluxos pagos possuem idempotência, registro financeiro e item de fila
  únicos, comprovados por testes.
- A página pública e o painel mantêm leitura e ações em 360, 768, 1366 e 1920
  px para os estados revisados.
- Preflight e smoke de staging passam com ambiente e URLs finais.
- Saque fica explicitamente indisponível enquanto não houver homologação, sem
  sugerir que valores sandbox podem ser transferidos.

## Decisão de acesso

A beta fechada usa convites obrigatórios. Cadastro sem convite válido não cria
conta nem organização. O convite é de uso único, associado ao e-mail informado
e auditado quando aceito ou revogado.
