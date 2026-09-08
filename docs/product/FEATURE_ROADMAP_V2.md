# StreamOS — Roadmap funcional revisado

Versão: 2.1
Referências: roadmap original, `StreamOS-Produto-e-Features-Ilustrado.pdf` v2.0 de julho de 2026 e telas de referência fornecidas em agosto de 2026.

## 1. Nova visão do produto

O StreamOS evolui de uma ferramenta de contribuição com alerta para um sistema operacional de monetização e interação para criadores. O produto será organizado em quatro pilares:

1. **Monetização:** contribuições, carteira, recebíveis, saques, assinaturas, vaquinhas e anúncios.
2. **Comunidade:** mensagens, recompensas, ranking, enquetes e benefícios para apoiadores.
3. **Experiência ao vivo:** alertas, widgets, mídia, TTS, metas, maratonas e controle remoto.
4. **Operação do criador:** página pública, moderação, integrações, equipe, segurança, API e analytics.

O visual e os fluxos serão próprios do StreamOS. As imagens servem como referência de categorias e necessidades do usuário, não como especificação para reprodução de outra plataforma.

## 2. Arquitetura de navegação proposta

### Visão geral

- Início
- Atividade ao vivo
- Contribuições
- Analytics

### Monetização

- Página de apoio
- Carteira
  - Resumo
  - Recebíveis
  - Extrato
  - Saques
  - Limites
- Assinaturas
- Vaquinhas
- Recompensas
- Anúncios

### Transmissão

- Alertas
- Widgets
- Metas
- Fila de mídia
- Controle remoto

### Comunidade

- Mensagens
- Apoiadores
- Ranking
- Enquetes
- Moderação

### Configurações

- Perfil e página pública
- Incentivos e checkout
- Verificação
- Conexões
- Integrações
- Equipe e permissões
- Segurança e sessões
- Minha conta
- API e webhooks

## 3. Catálogo funcional

### 3.1 Carteira e recebíveis

- Saldo disponível, pendente, bloqueado e em processamento.
- Agenda de recebíveis com data prevista de liberação.
- Extrato filtrável e exportável em CSV.
- Histórico de saques e comprovantes.
- Cadastro e validação de chave Pix do beneficiário.
- Limites mínimo, diário, mensal e por análise de risco.
- Contribuições confirmadas são finais e não oferecem reembolso pelo criador.
- Reserva de segurança, hold e explicação de cada movimentação.
- Conciliação e trilha de auditoria acessíveis ao suporte.

### 3.2 Incentivos e mensagens

- Mensagem de texto com apelido ou anonimato.
- Valor mínimo configurável pelo criador.
- TTS opcional, com voz, idioma, quota e custo por uso.
- Fila de áudio, vídeo e música sujeita a moderação.
- Filtros de palavras, links, repetição e abuso.
- Aprovação manual opcional antes de aparecer na live.
- Termos e consentimento no envio.
- Recibo e acompanhamento do status pelo apoiador.

### 3.3 Assinaturas

- Planos mensais com nome, preço, descrição e benefícios.
- Recompensas vinculadas ao plano.
- Status ativo, inadimplente, cancelado e expirado.
- Portal do assinante para alterar ou cancelar o plano.
- Eventos de renovação, falha, recuperação e cancelamento.
- Métricas de MRR, churn, retenção e receita por plano.
- Fase inicial com cobrança simulada; Pix Automático ou cartão somente após parceiro homologado.

### 3.4 Vaquinhas

- Campanha com título, descrição, meta, prazo e imagem.
- Página compartilhável e contribuição avulsa.
- Progresso, total líquido, número de apoiadores e atualizações.
- Campanhas públicas, não listadas, pausadas e encerradas.
- Regras de encerramento e destinação devem estar publicadas antes do apoio.
- Uma campanha pode alimentar widgets e alertas próprios.

### 3.5 Recompensas

- Benefícios digitais ou acesso a comunidades e conteúdos.
- Elegibilidade por contribuição única, acumulada ou assinatura.
- Quantidade limitada, validade e instruções de resgate.
- Códigos ou links únicos quando aplicável.
- Histórico de concessão, resgate, expiração e revogação.
- Integração futura com Discord e outras comunidades.

### 3.6 Widgets

- Catálogo com criação, duplicação, edição, ativação e exclusão.
- URL individual e token rotacionável para Browser Source.
- Preview responsivo, área segura e fundo transparente.
- Templates e temas próprios do StreamOS.
- Widgets iniciais:
  - Alerta de contribuição.
  - QR Code da página de apoio.
  - Meta de arrecadação.
  - Últimas contribuições.
  - Ranking de apoiadores.
  - Maratona/subathon com cronômetro.
  - Enquete em tempo real.
- Widgets posteriores:
  - Fila de vídeo.
  - SongPix e fila de músicas temática.
  - Vaquinha.
  - Assinaturas recentes.
- Configurações comuns: tipografia, cores, animação, duração, som, posição e regras de exibição.

### 3.7 Anúncios para criadores

- Assistente em etapas: segmentos, plataformas, formatos, overlay e revisão.
- Perfil de mídia do canal com categorias, audiência declarada e conexões verificadas.
- Formatos elegíveis: banner no overlay, menção, vídeo e ação patrocinada.
- Campanhas com orçamento, janela, frequência e segmentação.
- Aceite ou recusa explícita do criador.
- Registro de impressão/execução e relatório para anunciante e criador.
- Saldo de anúncios separado contabilmente das contribuições.
- Moderação, política de marcas e bloqueio de categorias sensíveis.
- Feature flag obrigatória; entra após o núcleo financeiro e de widgets estar estável.

### 3.8 Configurações e operação

- Perfil, slug, bio, imagem, redes e identidade visual.
- Verificação/KYC sandbox e, depois, provedor real.
- Conexões com Twitch, YouTube e Discord.
- Equipes com papéis de proprietário, administrador, moderador, financeiro e leitura.
- Permissões por ação e organização.
- Sessões, alteração e recuperação de senha sem 2FA nesta fase.
- Tokens de API com escopos, expiração e revogação.
- Webhooks configuráveis com assinatura, retry e histórico.
- Controle remoto para pausar, pular, repetir, aprovar e testar alertas.

### 3.9 SongPix temático

O SongPix permite que uma contribuição envie uma música para a fila da live. Cada sessão pode possuir um tema próprio, como “Sertanejo”, “Rock nacional”, “Anos 2000” ou uma seleção criada pelo streamer.

- Sessão com nome, descrição, capa, horário e estado `rascunho`, `aberta`, `pausada` ou `encerrada`.
- Um canal pode preparar várias sessões, mas apenas uma fica ativa por vez.
- Tema livre ou gênero permitido, com artistas, músicas e palavras-chave incluídos ou bloqueados.
- Valor mínimo geral e valores diferentes por duração ou prioridade.
- Limite por apoiador, duração máxima da faixa e tamanho máximo da fila.
- Pedido por URL ou busca em um provedor compatível.
- Captura de título, artista, duração, capa, provedor e identificador externo.
- Validação por metadados do provedor, regras do streamer e classificação assistida.
- Pedidos incertos ficam em revisão; não são rejeitados silenciosamente.
- Moderação manual com ações aprovar, rejeitar, pular, mover, priorizar e bloquear artista.
- O apoiador vê antes de pagar se a música é compatível com o tema.
- Se o pedido não puder ser validado antes do pagamento, ele não entra no checkout.
- Uma vaga na fila é reservada por poucos minutos durante o checkout para evitar pagamento quando a fila já estiver cheia.
- Painel “tocando agora”, próxima música, fila e histórico da sessão.
- Widget para OBS com faixa atual, próximo pedido e identificação do apoiador.
- Controle de reprodução, volume e avanço pelo controle remoto.
- Registro auditável do motivo de aprovação ou rejeição.

#### Regras de produto

- A contribuição paga pela interação e posição elegível na fila, não pela compra da música.
- Uma música só pode ser solicitada quando o provedor e a política da plataforma permitirem a experiência.
- O StreamOS não hospeda nem redistribui o arquivo musical.
- A reprodução respeita disponibilidade, autenticação e limitações do provedor conectado.
- A interface informa que aprovação não garante reprodução integral quando a live terminar, a fila for encerrada ou houver impedimento da plataforma.
- Como contribuições confirmadas não possuem reembolso, tema, disponibilidade, duração, duplicidade, limites e lotação da fila são validados antes da criação da cobrança.

#### Exemplo: Sextaneja

```text
Sessão: Sextaneja
Tema permitido: Sertanejo
Valor mínimo: R$ 5,00
Duração máxima: 6 minutos
Limite por apoiador: 3 pedidos
Revisão: automática + manual para gênero incerto
Bloqueios: versões ao vivo longas, conteúdo explícito e artistas definidos pelo canal
```

Fluxo:

```text
Apoiador busca ou cola a música
  → StreamOS consulta os metadados
  → valida gênero e regras da sessão
  → reserva temporariamente uma vaga na fila
  → mostra compatibilidade antes do pagamento
  → contribuição é confirmada
  → pedido entra na fila moderada
  → controle remoto inicia ou pula a faixa
  → widget atualiza “tocando agora”
```

### 3.10 VideoPix

O VideoPix permite que o apoiador envie um link de vídeo elegível para tocar em uma Browser Source da transmissão após a contribuição ser confirmada.

- Sessões independentes com estado `rascunho`, `aberta`, `pausada` ou `encerrada`.
- URL de vídeo de provedores homologados; YouTube é o primeiro adaptador proposto.
- Leitura prévia de título, canal, duração, publicação, visualizações, thumbnail e disponibilidade para incorporação.
- Preço configurável por segundo e contribuição mínima.
- Cálculo transparente: `valor = duração selecionada × preço por segundo`, respeitando o mínimo.
- Duração máxima padrão de cinco minutos, configurável para menos pelo criador e limitada por um teto de segurança da plataforma.
- Seleção opcional do trecho inicial e final quando o provedor permitir.
- Quantidade mínima de visualizações e idade mínima do vídeo configuráveis.
- Limite por apoiador, tamanho máximo da fila e cooldown entre pedidos.
- Reserva temporária de vaga antes da criação da cobrança.
- Preview e resumo das regras antes do pagamento.
- Fila com aprovar, rejeitar antes do pagamento, pausar, pular, reordenar e bloquear canal ou vídeo.
- Player para OBS com estado `aguardando`, `carregando`, `tocando`, `concluído`, `pulado` ou `falhou`.
- Volume máximo, fade-in/fade-out, tela de fallback e timeout de carregamento.
- Histórico completo com contribuição, vídeo, regras avaliadas e decisão de moderação.

#### Proteções de conteúdo

Visualizações mínimas reduzem links descartáveis, mas não provam que o conteúdo é seguro. A decisão combina:

- Provedor, disponibilidade de incorporação e metadados válidos.
- Visualizações mínimas e idade do vídeo.
- Duração e trecho solicitado.
- Safe Search, restrição etária e sinais do provedor quando disponíveis.
- Lista de canais e vídeos permitidos ou bloqueados.
- Termos proibidos em título, descrição e nome do canal.
- Classificação automática de thumbnail e metadados.
- Aprovação manual opcional ou obrigatória para canais desconhecidos.
- Denúncia, kill switch e bloqueio imediato no controle remoto.

#### Regra financeira

Como uma contribuição confirmada é final e não possui reembolso, todas as validações determinísticas acontecem antes da cobrança. Conteúdo que exigir revisão manual deve ser aprovado antes de liberar o pagamento. Se o provedor retirar ou bloquear um vídeo depois da confirmação, o incidente fica registrado e o alerta financeiro ainda permanece válido, mas o vídeo não é substituído automaticamente por conteúdo não aprovado.

#### Exemplo de configuração

```text
VideoPix ativo
Preço: R$ 0,05 por segundo
Contribuição mínima: R$ 3,00
Duração máxima: 300 segundos
Visualizações mínimas: 10.000
Idade mínima do vídeo: 7 dias
Trecho permitido: configurável pelo apoiador
Revisão manual: canais ainda não conhecidos
Volume máximo: 60%
```

Um vídeo de 90 segundos custaria `90 × R$ 0,05 = R$ 4,50`. Um trecho de 30 segundos resultaria em R$ 1,50, mas seria elevado para a contribuição mínima de R$ 3,00.

## 4. Sequência de implementação

### Marco A — fechar o núcleo do MVP local

Objetivo: tornar completa e demonstrável a jornada já existente.

- Onboarding, aceite de termos e checklist de ativação.
- Edição completa da página pública e slug.
- Checkout Pix mock com QR Code, copia e cola, anonimato, expiração e recibo.
- Detalhes de contribuição, comprovantes e histórico imutável.
- Carteira com recebíveis, extrato, saque, limites e chave Pix simulada.
- Rate limit, validação de entrada e testes de autorização entre organizações.

Critério de saída: cadastro → ativação → contribuição → alerta → recebível → saque funciona pelo navegador e possui trilha auditável.

### Marco B — plataforma de widgets

Objetivo: transformar o overlay único em um catálogo reutilizável.

- Entidade `Widget`, configurações versionadas e instâncias por organização.
- Editor e preview compartilhados.
- QR Code, alerta, meta, últimas contribuições e ranking.
- Token individual, rotação, ACK, replay e teste por widget.
- Controle remoto básico.

Critério de saída: o criador cria e personaliza vários widgets, adiciona URLs diferentes ao OBS e controla a fila pelo painel.

### Marco C — moderação e mídia

Objetivo: permitir experiências ricas sem expor a live a abuso.

- Política de mensagens e fila de aprovação.
- TTS com quotas e cache.
- Upload/URL de mídia com validação, limites e análise.
- Fila de vídeo e música.
- Fundação do SongPix: sessões, regras temáticas, validação pré-pagamento e fila moderada.
- Fundação do VideoPix: adaptador de metadados, precificação por segundo, análise pré-pagamento e player isolado.
- Logs de decisão e ferramentas do moderador.

Critério de saída: nenhum texto ou conteúdo de mídia é transmitido antes da decisão automática ou manual definida pelo criador.

### Marco D — comunidade e campanhas

Objetivo: melhorar retenção e frequência de apoio.

- Vaquinhas e páginas de campanha.
- Recompensas e resgates.
- Ranking por período.
- Enquetes em tempo real.
- Maratona/subathon.
- Segmentação de apoiadores e mensagens do criador.

Critério de saída: cada mecânica usa os mesmos eventos financeiros, regras de moderação e widgets, sem duplicar saldo ou checkout.

### Marco E — assinaturas

Objetivo: criar receita recorrente.

- Modelos `SubscriptionPlan`, `Subscription` e `SubscriptionCycle`.
- Planos e benefícios no painel e na página pública.
- Cobrança recorrente simulada e ciclo completo de estados.
- Portal do assinante, notificações e analytics.
- Adaptador real somente após homologação do parceiro.

Critério de saída: renovação repetida ou fora de ordem não duplica cobrança, benefício nem lançamento contábil.

### Marco F — equipes, integrações e API

Objetivo: permitir operação profissional do canal.

- Convites, membros, papéis e permissões granulares.
- Twitch, YouTube e Discord por adaptadores.
- Tokens de API com escopos.
- Webhooks de saída e painel de entregas.
- Auditoria de ações administrativas.

Critério de saída: moderadores e equipe financeira acessam apenas o necessário, e todas as ações sensíveis são auditadas.

### Marco G — anúncios

Objetivo: adicionar uma segunda fonte de monetização.

- Perfil de mídia e segmentos do canal.
- Wizard de formatos e posicionamento.
- Inventário, campanhas, aceite, agenda e limites de frequência.
- Eventos de veiculação e relatórios.
- Ledger separado, moderação de marca e backoffice comercial.

Critério de saída: toda veiculação possui consentimento, evidência, campanha, valor e lançamento rastreáveis.

### Marco H — integração financeira e lançamento

- Seleção do parceiro regulado.
- KYC/KYB, Pix, saque e conciliação em sandbox.
- Testes de contrato, carga, caos e recuperação.
- Observabilidade, SLOs, backups e resposta a incidentes.
- Piloto progressivo com feature flags.

### Marco I — gamificação avançada

Objetivo: transformar contribuições em experiências recorrentes durante a live.

- Metas dinâmicas com fases, prazo, urgência e consequência.
- Streak diário, semanal, mensal ou por live.
- Boss Battle com HP, dano, fases, equipes, combos e cooldown.
- Loot Drops com probabilidades públicas e sem recompensa financeira aleatória.
- PixAthon/subathon com cronômetro e milestones.
- Ranking sazonal com privacidade e opt-out.
- Motor de regras sem código com gatilhos, condições, ações, limites e auditoria.

Critério de saída: repetir um evento não duplica dano, tempo, recompensa ou pontuação, e toda regra executada pode ser explicada pela trilha de auditoria.

### Marco J — inteligência e experiência pós-live

Objetivo: ajudar o criador a operar e monetizar melhor, sem permitir que IA altere dinheiro ou autorize ações críticas.

- Relatório por live com receita, conversão, ticket, retenção e incidentes.
- Timestamps e geração assistida de highlights.
- Coach de monetização com recomendações justificadas pelos dados.
- Sugestões contextuais de metas e campanhas.
- Resumo operacional da transmissão.
- Moderação assistida com revisão humana e feedback.
- Quotas, cache, anonimização, consentimento e fallback sem IA.

### Marco K — aplicativo e escala comercial

- Aplicativo móvel para notificações, moderação e controle durante a live.
- Aprovar mídia, pausar alertas, alterar meta e consultar carteira.
- Planos Start, Creator Pro, Studio e Enterprise.
- Quotas por plano para TTS, mídia, IA, integrações e equipe.
- Múltiplos canais, marketplace, white-label e SLA nas versões posteriores.
- Segundo parceiro financeiro e estratégia de contingência.

## 5. Backlog imediato — próximos três ciclos

### Ciclo 1 — onboarding e checkout completo

- Aceite de termos versionado.
- Checklist de ativação.
- Editor de perfil público e slug.
- QR Code e Pix copia e cola mock.
- Anonimato, expiração, confirmação e recibo.
- E2E pelo navegador.

### Ciclo 2 — carteira operacional

- Agenda de recebíveis.
- Extrato com filtros e CSV.
- Chave Pix simulada e limites.
- Histórico e detalhe de saque.
- Cancelamento de cobranças ainda não confirmadas.
- Testes de autorização e invariantes.

### Ciclo 3 — fundação de widgets

- Modelo e catálogo de widgets.
- Editor base e preview.
- Widgets de alerta, QR Code, meta, ranking e últimas contribuições.
- URLs e tokens individuais.
- Controle remoto inicial.

### Ciclo 4 — SongPix temático

- Modelos `SongSession`, `SongRequest` e `SongRule`.
- Criação e ativação de uma sessão temática.
- Adaptador mock de catálogo musical para desenvolvimento local.
- Validação de gênero, artista, duração e conteúdo antes do pagamento.
- Associação idempotente entre contribuição confirmada e pedido.
- Painel de fila e controles de moderação.
- Widget “tocando agora”.
- Testes de música incompatível, duplicada, fila cheia e evento repetido.

### Ciclo 5 — VideoPix

- Modelos `VideoSession`, `VideoRequest` e `VideoRule`.
- Adaptador mock e contrato para provedores de vídeo.
- Consulta e validação de metadados antes do pagamento.
- Precificação por segundo, valor mínimo e duração máxima.
- Reserva de vaga na fila com expiração.
- Moderação automática e revisão pré-pagamento.
- Player isolado no overlay e controle remoto.
- Testes de vídeo privado, removido, não incorporável, longo, sem views suficientes, duplicado e indisponível após confirmação.

## 6. Priorização

| Grupo | Funcionalidade | Prioridade | Dependência principal |
| --- | --- | --- | --- |
| Núcleo | Onboarding e página pública | P0 | Contas |
| Núcleo | Checkout e recibo | P0 | Pagamentos |
| Financeiro | Recebíveis, extrato e saques | P0 | Ledger |
| Streaming | Plataforma de widgets | P0 | Realtime/outbox |
| Segurança | Rate limit e autorização | P0 | Identidade |
| Comunidade | Moderação e TTS | P1 | Widgets |
| Comunidade | Vaquinhas e recompensas | P1 | Checkout/ledger |
| Receita | Assinaturas | P1 | Parceiro recorrente |
| Operação | Equipes, integrações e API | P1 | RBAC/auditoria |
| Receita | Anúncios | P2 | Widgets/analytics/comercial |
| Streaming | Vídeo e música | P2 | Moderação/mídia |
| Streaming | SongPix temático | P1 | Checkout/widgets/moderação |
| Streaming | VideoPix | P1 | Checkout/widgets/moderação |
| Engajamento | Motor de regras e Boss Battle | P2 | Widgets/campanhas |
| Inteligência | Coach e highlights | P3 | Analytics/consentimento |
| Plataforma | Aplicativo móvel | P3 | APIs/controle remoto |

## 7. Decisões de produto necessárias

- Definir se vaquinhas movimentam o mesmo saldo geral ou possuem reserva própria.
- Definir critérios de recompensa e responsabilidade pela entrega.
- Escolher a primeira plataforma de streaming integrada.
- Definir política de mídia, direitos autorais e conteúdo proibido.
- Escolher o modelo de assinatura e o parceiro de recorrência.
- Definir como anúncios serão vendidos, medidos e aprovados.
- Determinar papéis de equipe e ações financeiras permitidas.
- Definir limites de saque para a fase sem 2FA; dinheiro real permanece bloqueado.

## 8. Fora do escopo imediato

- Custódia direta de recursos.
- Saque real sem autenticação forte e parceiro regulado.
- Marketplace público de extensões.
- Aplicativo móvel nativo.
- IA autorizando decisões financeiras ou de moderação irreversíveis.
- Reprodução integral da identidade visual ou dos fluxos de concorrentes.

## 9. Rastreabilidade do PDF de produto v2.0

O PDF ilustrado permanece como visão de produto de longo prazo. O roadmap revisado altera a ordem de construção, não elimina seus pilares.

| Pilar do PDF | Destino neste plano |
| --- | --- |
| Conta, KYC/KYB, consentimentos e dispositivo | Marcos A e H |
| Pix, cartão, recibo e anonimato | Marcos A e H |
| Ledger, carteira e saque | Marcos A e H |
| Alertas, TTS, mídia, cenas e replay | Marcos B e C |
| Assinaturas e Pix Automático | Marco E e integração do Marco H |
| Metas, ranking, Boss Battle, streak, loot e PixAthon | Marcos D e I |
| Twitch, Kick, YouTube, Spotify, Discord e OBS | Marcos F, C e I |
| Motor de regras e automações | Marco I |
| Moderação e antifraude | Marcos C e H |
| Coach, highlights e resumo pós-live | Marco J |
| Dashboard e analytics por live | Marcos D, E e J |
| Aplicativo móvel | Marco K |
| API, marketplace e white-label | Marcos F e K |
| Planos Start, Creator Pro, Studio e Enterprise | Marco K |

### Regras preservadas do documento original

- O StreamOS controla a experiência, os dados, as regras e o ledger, usando parceiros regulados nos trilhos financeiros.
- O tempo P95 entre confirmação e alerta continua com meta inferior a dois segundos.
- O ledger é imutável, idempotente e conciliável; saldo nunca é um campo editado manualmente.
- Texto ou mídia passam por moderação antes da transmissão conforme a política do criador.
- Integrações são adaptadores e não contaminam o núcleo financeiro.
- IA não autoriza saque nem altera lançamentos financeiros.
- Dinâmicas aleatórias são transparentes e não oferecem prêmio financeiro que possa caracterizar aposta.

### Política de finalidade das contribuições

- O produto usa os termos **contribuição** ou **apoio** até a validação do enquadramento jurídico aplicável; “doação” não é presumido apenas pela experiência do produto.
- Uma cobrança pode expirar ou ser cancelada antes da confirmação.
- Depois da confirmação, a contribuição é final no fluxo normal e o criador não possui ação de reembolso.
- O alerta, a meta e as demais experiências usam apenas eventos confirmados.
- Reversões impostas pelo provedor, disputas ou correções operacionais excepcionais não são tratadas como feature de reembolso: entram como incidente de suporte, com lançamento compensatório e auditoria.
