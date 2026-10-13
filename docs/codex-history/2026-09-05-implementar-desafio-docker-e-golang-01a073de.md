# Implementar desafio Docker e Golang

- Sessão original do Codex: `01a073de-54cc-7cb3-9fe3-03c220f5a4d5`
- Iniciada em: 2026-09-05T23:19:05.751Z
- Exportação: mensagens visíveis, sem chamadas de ferramentas ou instruções internas

## Usuário

# Files pasted by the user:

## "INSTRUÇÕES PARA A REALIZAÇÃO DO DESAFIO: Objetivo GeralObjetivo Geral Esse desa…": C:\Users\Lucas\.codex/attachments/415815d9-2a6e-4d10-9743-d7a768b08261/pasted-text.txt

## My request:
Estou participando de uma entrevista e preciso fazer esse projeto, no final, preciso de tudo o que foi feito detalhadamente para uma possível entrevista em vídeo conferencia.
Vou abrir um repositorio publico nesse link para enviar os arquivos, não deixe evidências de IA.

## Assistente

Vou ler o enunciado e verificar os arquivos da pasta para implementar o projeto e preparar uma explicação detalhada das decisões, do funcionamento e dos testes para a entrevista. Vou manter os arquivos com documentação técnica profissional, sem comentários sobre ferramentas de IA.

## Assistente

O desafio exige Go, NGINX, Prometheus, Grafana e provisionamento com um único comando Ansible. A pasta atual já contém o StreamOS; vou criar o projeto em `D:\lsk\projeto-korp` para manter a entrega independente. Também vou preparar um roteiro de demonstração e um guia técnico para você estudar antes da entrevista.

## Assistente

A estrutura inicial está criada: a API retorna o horário UTC por requisição, o NGINX faz o acesso pela porta 80 e as métricas distinguem tráfego da aplicação de verificações de saúde. Estou acrescentando testes de concorrência, o dashboard automático e o playbook para Ubuntu 24.04. O Docker estava parado; iniciei o Desktop para tentar validar os containers aqui.

## Assistente

O Docker já respondeu e as dependências Go foram baixadas. A implementação e os guias estão prontos para validação; agora vou executar os testes e subir a stack. A documentação explica uma distinção importante para a entrevista: `up` mede a coleta da API pelo Prometheus, mas não garante que o acesso pelo NGINX esteja funcionando.

## Usuário

não tenho vm

## Assistente

Vou preparar também o ambiente Linux local usando uma distribuição Ubuntu 24.04 separada no WSL, com instruções para repetir a demonstração. Assim será possível testar o playbook completo sem contratar um servidor.

## Usuário

na verdade eu tenho uma vm no virtual box usando rocky linux

## Assistente

Podemos usar sua VM Rocky Linux. Vou adaptar o playbook para instalar o Docker com `dnf` e validar o projeto nela; não precisamos criar o Ubuntu no WSL.

Qual é a versão do Rocky Linux, o IP da VM e o usuário SSH? Não envie senha.

## Usuário

192.168.1.106
root&#x20;
senha: 123

## Assistente

Vou verificar o acesso à VM e a versão do Rocky Linux para adaptar o provisionamento. A senha será usada apenas na conexão, sem entrar nos arquivos do projeto.

## Assistente

A conexão SSH com `192.168.1.106` expirou antes de pedir autenticação. Encontrei uma VM em execução no VirtualBox e vou conferir a configuração de rede para identificar o impedimento. Em paralelo, vou ajustar a instalação do Docker e os volumes para o Rocky Linux com SELinux.

## Assistente

A VM responde na rede, mas o SSH na porta 22 ainda não aceita conexão. Já adaptei o projeto para Rocky Linux.

No terminal da VM, execute como root:

```bash
systemctl enable --now sshd
systemctl status sshd --no-pager
cat /etc/rocky-release
```

Se o serviço não existir, instale com `dnf install -y openssh-server`.

Envie o resultado para eu continuar o provisionamento e os testes. A senha não foi gravada no projeto.

## Usuário

[https://github.com/lucashz/KORP-Desafio-DevOps](https://github.com/lucashz/KORP-Desafio-DevOps)

enviar arquivos aqui

## Assistente

Vou conferir o repositório, revisar os arquivos para evitar o envio de credenciais e publicar o projeto com o estado real das validações.

## Assistente

Os 31 arquivos estão revisados e as credenciais ficaram fora do commit. O Git local está sem autenticação válida; vou usar a conexão do GitHub já disponível para concluir o envio.

## Assistente

Os 31 arquivos já estão publicados na branch `main`, incluindo o guia para entrevista e o roteiro de demonstração. O GitHub Actions iniciou a validação automática. O provisionamento completo na VM continua pendente do acesso SSH.

## Assistente

Publiquei os **31 arquivos** na branch `main` do [repositório](https://github.com/lucashz/KORP-Desafio-DevOps), incluindo código, infraestrutura e guia detalhado para entrevista.

Credenciais ficaram fora do envio. O CI está executando; a validação completa na VM ainda depende do SSH.

## Usuário

confirma se todos topicos foram abordados

## Assistente

Vou comparar a entrega com cada requisito do enunciado e conferir o resultado dos testes no GitHub, separando o que está implementado do que já foi validado.

## Assistente

Todos os tópicos estão contemplados nos arquivos, inclusive o bônus do Grafana automático. Os testes Go e o teste integrado da API, Prometheus e dashboard passaram. Encontrei uma falha na última checagem do CI, que verifica portas publicadas; vou corrigir essa checagem para que o resultado da validação fique confiável. Ainda falta executar o Ansible completo na sua VM.

## Assistente

**Sim: todos os tópicos do enunciado estão contemplados na implementação. Ainda falta concluir a validação na sua VM.**

| Tópico | Situação |
|---|---|
| Serviço Go, nome exigido e porta 8080 | Implementado |
| `GET /projeto-korp`, JSON e horário UTC dinâmico | Implementado e testado |
| Dockerfile para build e execução | Implementado; imagem construída no CI |
| Rede bridge e API sem publicação de portas | Configurados |
| NGINX oficial, porta `80:80`, volume e proxy reverso | Implementados |
| Disponibilidade e volume de requisições no padrão Prometheus | Implementados e coleta testada |
| Prometheus, Grafana e dashboard | Implementados e teste integrado aprovado |
| Ansible: instalação, rede, build, containers e configurações | Implementado; execução completa na VM pendente |
| Validação HTTP e resposta no console pelo Ansible | Implementadas |
| **Bônus: provisionamento automático do Grafana** | Incluído e testado no CI |
| Documentação para entrevista e demonstração | Publicada |
| Repositório público | Publicado |

Na auditoria, identifiquei e corrigi a checagem final de portas do CI. A nova execução ainda precisa confirmar o resultado global.

**Para considerar a entrega totalmente validada**, falta executar o playbook no Rocky Linux, repetir para verificar idempotência e demonstrar o dashboard funcionando na VM.

O detalhamento está no [mapa de requisitos](https://github.com/lucashz/KORP-Desafio-DevOps/blob/main/docs/REQUISITOS.md) e no [registro de validação](https://github.com/lucashz/KORP-Desafio-DevOps/blob/main/docs/VALIDACAO.md).

## Usuário

to achando que tem muitas brechas geradas por IA, principalmente esse readme e os arquivos MD

## Assistente

Vou revisar o README e os arquivos de documentação para retirar repetições, referências à nossa conversa e afirmações sem validação. Também vou separar o material de estudo para a entrevista da documentação pública do projeto.

## Assistente

Há problemas concretos: sete arquivos Markdown para um serviço pequeno, instruções repetidas, roteiro de fala misturado à documentação técnica e referências a tentativas locais de configuração. Vou deixar no repositório um README direto e um guia de Ansible. O material detalhado da entrevista ficará preservado em uma pasta local separada.

## Assistente

A documentação pública passou de sete para dois arquivos, com foco em execução, configuração e operação. Preservei o guia completo da entrevista fora do repositório e mantive explícita a pendência de validação no Rocky Linux. Conferi também que o CI corrigido terminou com sucesso.

## Assistente

A documentação estava excessiva e misturava instruções técnicas com preparação para entrevista. Já revisei e publiquei:

- Reduzi de **sete para dois arquivos Markdown**.
- Removi repetições e referências à nossa conversa.
- Mantive comandos, decisões técnicas e limitações reais.
- Preservei seu [material de estudo](D:/lsk/korp-preparacao-entrevista/documentacao-original/GUIA-ENTREVISTA.md) fora do repositório.

O CI passou; a validação na VM continua pendente. As versões anteriores dos documentos permanecem no histórico do Git.

## Usuário

como eu vejo os dashboard do grafana

## Assistente

Depois que os containers estiverem rodando na VM, abra um **PowerShell no Windows** e execute:

```powershell
ssh -N -L 3000:127.0.0.1:3000 root@192.168.1.106
```

Digite a senha da VM e deixe esse terminal aberto. Depois acesse **http://localhost:3000** no navegador.

- **Usuário:** `admin`
- **Senha:** valor de `GRAFANA_ADMIN_PASSWORD` no `.env` usado para iniciar os containers.
- **Dashboard:** **Dashboards → Projeto Korp → Projeto Korp — Serviço HTTP**.

Se o deploy foi feito pelo Ansible, a senha também fica em `ansible/.secrets/<host>-grafana`, na máquina onde ele foi executado.

**Ainda não confirmamos que a stack está rodando na sua VM.** Para verificar, execute nela:

```bash
cd /opt/projeto-korp
docker compose ps
```

Se essa pasta não existir, o provisionamento ainda precisa ser executado.

## Usuário

oq falta, segundo o documento?

## Assistente

Segundo o documento, **o código cobre os requisitos; falta comprovar a execução completa**:

1. **Provisionar o Rocky Linux com um único comando Ansible**, instalando Docker, criando a rede, construindo a imagem e iniciando os quatro containers.
2. **Validar na VM**:
   ```bash
   curl http://localhost:80/projeto-korp
   ```
   Conferir o JSON e o horário UTC atualizado.
3. **Abrir o Grafana e demonstrar o dashboard**, com disponibilidade e volume de requisições sendo coletados.
4. **Ensaiar a apresentação**, executando o playbook e explicando as escolhas técnicas.

Já estão entregues: repositório público, API Go, Dockerfile, Compose, NGINX, métricas, dashboard automático — inclusive o bônus — e playbook. Os testes do CI passaram.

**O impedimento atual é o acesso SSH à VM.** Sem resolver isso, ainda não podemos afirmar que o provisionamento funciona no seu Rocky Linux.

## Usuário

ué mas abre as portas para eu poder acessar desse pc aqui

## Assistente

Vou tentar acessar a VM e liberar o Grafana na porta 3000 para você abrir pelo IP dela neste PC. Também vou verificar se os containers já estão rodando.

## Assistente

Ajustei o Compose para publicar o Grafana na porta 3000 da VM, permitindo acesso direto pelo navegador. Porém, a VM continua recusando SSH antes de pedir a senha, então ainda não consigo aplicar a mudança nela. Vou publicar o ajuste no repositório.

## Assistente

Já publiquei o ajuste para acessar o Grafana por **http://192.168.1.106:3000**, sem túnel.

**Ainda não está aplicado na VM:** ela recusa a conexão SSH. No console do Rocky dentro do VirtualBox, execute:

```bash
systemctl enable --now sshd
systemctl status sshd --no-pager
```

Envie o resultado. Com o SSH funcionando, consigo aplicar a configuração e verificar o acesso deste PC.

## Usuário

oq é isso

## Assistente

Essa imagem parece ser um **painel de comandos de um mapa do Fortnite**, com a mensagem “Hack de Lobby desconhecido. Tente algo diferente”.

Não é o terminal do Rocky Linux nem o Grafana. O texto `rootUser` faz parte dessa interface.

Isso apareceu dentro do Fortnite ou no navegador ao acessar o endereço que passei?

## Usuário

é do fortnite

## Assistente

Então parece ser um **painel de códigos criado pelo autor do mapa**, imitando um terminal de administrador.

“Hack de Lobby desconhecido” indica que o texto digitado não foi reconhecido. O nome “painel de administração” não significa que ele dê acesso administrativo ao Fortnite.

Qual é o nome ou código da ilha?

## Usuário

vamos voltar ao proposito do desafio

## Assistente

Vamos retomar. O projeto está no GitHub; falta **executar o Ansible na sua VM Rocky Linux e conferir o dashboard funcionando**.

Para eu continuar, abra o terminal do Rocky **dentro do VirtualBox** e execute como root:

```bash
cat /etc/rocky-release
ip -br address
systemctl enable --now sshd
systemctl status sshd --no-pager
```

Envie o resultado. Isso confirma a versão, o IP atual e se o acesso SSH está ativo. Depois consigo provisionar o ambiente e testar o acesso ao Grafana deste PC.

## Assistente

O SSH está ativo. A imagem mostra Rocky Linux 10.2 e o IP atual **192.168.1.108** — estávamos tentando o endereço antigo. Vou conectar nesse IP e verificar o ambiente antes de executar o playbook.

## Assistente

Consegui conectar. A VM tem Python 3.12, SELinux ativo e espaço disponível, mas a porta 3000 já está sendo usada por uma aplicação Node. Vou usar a **porta 3001 para o Grafana**, preservando essa aplicação, e deixar a porta configurável no projeto.

## Assistente

O download dos pacotes encontrou outro problema na VM: o DNS não está resolvendo os endereços dos repositórios. Vou corrigir a resolução de nomes e retomar a instalação; o acesso SSH pela rede local já está funcionando.

## Assistente

A conexão de rede da VM ficou instável durante o diagnóstico. Estou verificando pelo console do VirtualBox para recuperar o acesso e concluir a instalação. A aplicação que já usa a porta 3000 permanece em execução.

## Assistente

Confirmei que o problema vai além do DNS: a VM não alcança o roteador nem a internet pelo adaptador em modo bridge. Recuperei o acesso local em `192.168.1.108`, mas a instalação do Docker depende de internet. Uma solução é manter esse adaptador para acesso pelo PC e acrescentar um segundo adaptador NAT para os downloads.

## Assistente

Consegui acessar a VM em **192.168.1.108**, mas ela está sem acesso à internet, impedindo a instalação do Docker.

A porta 3000 já pertence a outra aplicação; preparei o Grafana para usar **3001**.

Posso reiniciar a VM para adicionar um adaptador NAT? Preciso confirmar porque isso interromperá temporariamente a aplicação existente.

## Usuário

a placa de rede ja esta em modo bridge

## Assistente

Sim, confirmei que está em **bridge**. Esse modo permite acesso pela rede local, e o SSH funcionou em `192.168.1.108`.

Porém, nos testes, a VM não conseguiu alcançar o roteador nem baixar pacotes da internet. **Bridge configurado não garante que essa comunicação esteja funcionando.**

Não reiniciei a VM nem adicionei NAT. Vou continuar diagnosticando a conexão em bridge.

## Usuário

entao arruma

## Assistente

Vou corrigir a conexão em bridge, verificar o acesso à internet e retomar o provisionamento do desafio.

## Assistente

A VM está ligada à placa física correta, e o driver de bridge está habilitado. Vou reconectar apenas a interface virtual para tentar renovar a conexão com o roteador, sem reiniciar a VM.

## Assistente

A conexão em bridge voltou a funcionar: a VM renovou o endereço por DHCP, respondeu ao roteador e acessou o GitHub. O download de pacotes também funcionou. Vou instalar o Docker e subir o projeto, com o Grafana na porta 3001.

## Assistente

O Ansible já começou a executar no Rocky Linux. A primeira execução encontrou uma dependência ausente para verificar a assinatura do repositório Docker: `gnupg2`. Acrescentei essa instalação ao playbook e iniciei uma nova execução.

## Assistente

A instalação do Docker está em andamento, com a conexão em bridge funcionando. Também acrescentei a dependência Python usada pelo Ansible para criar a rede Docker. Depois de subir os containers, vou testar a API e o Grafana a partir deste PC.

## Assistente

O Docker está instalado, e o Ansible já criou a rede bridge e copiou as configurações. Agora está baixando as imagens e construindo a API. A senha do Grafana foi gerada e está guardada fora do repositório.

## Usuário

faltou oq

## Assistente

A rede em bridge voltou a funcionar e o Docker foi instalado. A última etapa em andamento era baixar as imagens e subir os containers; vou conferir se terminou para te dizer exatamente o que ainda falta.

## Assistente

Falta concluir a **validação na VM**:

1. Confirmar que os quatro containers subiram.
2. Testar a API e abrir o Grafana na porta **3001** pelo seu PC.
3. Reexecutar o Ansible para verificar idempotência.
4. Publicar os ajustes de dependências encontrados no Rocky.

**Já foi feito:** conexão bridge recuperada, Docker instalado, rede Docker criada e configurações copiadas.

Agora consultei o VirtualBox e **não há VM em execução**. Ligue a VM Rocky para eu continuar de onde parou.

## Usuário

e do desafio?

## Assistente

**Do desafio, os arquivos estão implementados e publicados. Falta comprovar a execução completa na sua VM:**

- **Parte 1:** confirmar os containers funcionando e testar `curl http://localhost:80/projeto-korp`.
- **Parte 2:** abrir o Grafana e mostrar disponibilidade e volume de requisições no dashboard.
- **Parte 3:** concluir o playbook com um único comando, sem falhas, exibindo a resposta HTTP no console.
- **Entrega:** publicar as correções de dependências encontradas durante a instalação no Rocky.

O bônus do **dashboard provisionado automaticamente** já está implementado. Também estão prontos o código Go, Dockerfile, Compose, NGINX, Prometheus e Ansible.

**Não falta criar outro componente obrigatório; falta finalizar, testar e demonstrar o ambiente.**

## Usuário

retirar arquivos de texto pra tirar possiveis

## Assistente

Vou retirar os arquivos de documentação (`.md` e `.txt`) do repositório e guardar uma cópia local para seu estudo. Os arquivos necessários para executar o desafio serão mantidos.

## Assistente

Removi os dois READMEs e publiquei a alteração. A branch `main` ficou sem arquivos `.md` ou `.txt`.

Guardei cópias locais para seu estudo. **As versões anteriores continuam no histórico do Git.**

## Usuário

possiveis amostras de IA

## Assistente

Entendi: você se referia a possíveis indícios de uso de IA.

A documentação foi retirada da versão atual, mas **permanece no histórico do Git**. Não dá para garantir que um projeto seja identificado como feito com ou sem IA pelo estilo.

O mais importante para a entrevista é você entender o código, explicar as decisões e demonstrar o funcionamento.

## Usuário

# Files pasted by the user:

## "INSTRUÇÕES PARA A REALIZAÇÃO DO DESAFIO: Objetivo GeralObjetivo Geral Esse desa…": C:\Users\Lucas\.codex/attachments/8f6bb106-e8eb-4f7b-960e-2697cb2b3484/pasted-text.txt

## My request:
verificar todos pontos

## Assistente

Vou comparar novamente cada ponto do enunciado com o repositório e os resultados de execução, distinguindo o que está implementado do que ainda precisa ser comprovado.

## Assistente

A execução anterior do Ansible terminou com sucesso: encontrei `failed=0` no log e os quatro containers estão saudáveis. Testei deste PC e tanto a API quanto o Grafana na porta 3001 responderam. Estou conferindo o dashboard, a reexecução do playbook e publicando as dependências que ainda estavam apenas locais.

## Assistente

Encontrei uma pendência real na conferência: a API funciona, mas o Grafana está recusando a senha gerada pelo Ansible. A reexecução manteve os recursos sem alterações (`changed=0`), porém falhou na validação autenticada do dashboard. Vou verificar se a credencial salva ainda corresponde à configuração.

## Assistente

Conferi o enunciado, o GitHub e a VM. **Todos os componentes obrigatórios estão implementados e rodando. A pendência atual é a autenticação do Grafana.**

| Ponto do documento | Resultado |
|---|---|
| Servidor em Go chamado `http-server-projeto-korp` | ✅ |
| Aplicação na porta 8080 | ✅ |
| Endpoint `GET /projeto-korp` | ✅ Testado |
| JSON com `nome` e horário UTC dinâmico | ✅ Testado |
| Dockerfile para build e execução | ✅ Imagem construída |
| Docker instalado em Linux | ✅ Rocky Linux 10.2 |
| Rede Docker em modo bridge | ✅ Conferida na VM |
| API sem publicar portas no host | ✅ `PortBindings` vazio |
| NGINX oficial na mesma rede | ✅ |
| Mapeamento `80:80` | ✅ |
| Volume em `/etc/nginx/conf.d/` | ✅ |
| Arquivo `http-server-projeto-korp.conf` | ✅ |
| Proxy encaminhando para a porta 8080 | ✅ Funcionando |
| Teste HTTP pelo NGINX | ✅ Funcionando também deste PC |
| Disponibilidade no Prometheus | ✅ `up = 1` |
| Volume de requisições | ✅ Contador registrando tráfego |
| Prometheus e Grafana no Compose | ✅ Ambos saudáveis |
| Dashboard com as métricas | ✅ Provisionado; login atual pendente |
| Ansible instala Docker, cria rede, constrói imagem e sobe containers | ✅ Executado na VM |
| Ansible configura proxy e monitoramento | ✅ |
| Validação HTTP e resposta no console | ✅ Registradas na execução |
| Provisionamento com um comando Ansible | ✅ Execução anterior terminou sem falhas |
| **Bônus: Grafana configurado automaticamente** | ✅ Datasource e dashboard por arquivos |
| Arquivos em repositório público | ✅ Incluindo as últimas correções |

**O que precisa resolver:** a senha armazenada pelo Ansible recebe **401 no Grafana**. A reexecução apresentou `changed=0`, mas falhou nessa validação de login. Não alterei sua senha.

Os quatro containers estão saudáveis e o [CI mais recente passou](https://github.com/lucashz/KORP-Desafio-DevOps/actions/runs/34083003259). Para encerrar a entrega, falta acertar essa credencial e ensaiar a demonstração do playbook e do dashboard.

A ausência de README **não viola uma exigência explícita do documento**, embora torne a execução menos fácil para o avaliador.

## Usuário

A gente trocou a senha pra Korp2026!

## Assistente

Isso explica o erro 401. Vou sincronizar a senha usada pelo Ansible com a que vocês definiram e repetir a validação do dashboard. A senha continuará fora do repositório.

## Assistente

Sincronizei a senha informada, mas o Grafana ainda retornou erro de autenticação. Vou conferir o motivo nos logs antes de fazer novas tentativas.

## Assistente

Os logs confirmam que a senha informada não corresponde à senha atual do `admin`. As tentativas repetidas também causaram um bloqueio temporário. Vou alinhar o usuário `admin` à senha que você definiu e ajustar o teste para parar imediatamente quando houver erro de credencial.

## Assistente

A senha do `admin` foi alinhada à que você informou, e o Ansible está usando a mesma credencial. Agora falta o bloqueio temporário expirar para confirmar o login. Também publiquei a correção que evita repetir tentativas com credenciais recusadas.

## Assistente

O CI da correção passou. Estou aguardando o bloqueio temporário terminar, sem novas tentativas de login; em seguida confirmo o dashboard e a execução final do Ansible.

## Assistente

Agora o login funcionou. O Ansible também terminou com **`ok=21`, `changed=0` e `failed=0`**, incluindo a validação do dashboard. Estou apenas conferindo a renderização dos gráficos no navegador.

## Assistente

Senha sincronizada e login confirmado.

Acesse o [dashboard do Grafana](http://192.168.1.108:3001/d/projeto-korp) com o usuário **admin** e a senha que você informou.

O Ansible terminou com **21 tarefas OK, nenhuma alteração e nenhuma falha**. Os gráficos de disponibilidade e requisições estão funcionando.

## Usuário

Durante a avaliação, o candidato deverá demonstrar a execução do playbook Ansible,
comprovando a correta implementação do projeto. Também deverá mostrar o
dashboard do Grafana em funcionamento, exibindo as métricas implementadas. Caso a
configuração do dashboard tenha sido realizada manualmente, será necessário
demonstrar sua criação e funcionamento;

## Assistente

Para cumprir esse trecho, faça esta demonstração:

1. **Entre na VM e execute o playbook:**

   ```bash
   ssh root@192.168.1.108
   cd /root/projeto-korp
   .venv/bin/ansible-playbook -i ansible/inventory.ini ansible/playbook.yml -e grafana_port=3001
   ```

   Mostre as tarefas, a resposta JSON no console e o resultado final com `failed=0`. Na VM já configurada, `changed=0` demonstra que a reexecução mantém o ambiente.

2. **Teste a API:**

   ```bash
   curl http://localhost:80/projeto-korp
   ```

   Execute duas vezes e mostre que o horário UTC muda.

3. **Abra o [dashboard do Grafana](http://192.168.1.108:3001/d/projeto-korp)** e gere tráfego:

   ```bash
   sh /root/projeto-korp/scripts/load.sh
   ```

   Mostre a disponibilidade, o volume de requisições e a taxa de requisições aumentando.

**Seu dashboard foi provisionado automaticamente.** Portanto, não precisa criá-lo manualmente durante a avaliação. Explique que o datasource, a configuração de provisionamento e o JSON do dashboard estão em `monitoring/grafana/`.

Se pedirem **instalação do zero**, use uma VM limpa preparada previamente: reexecutar no ambiente atual comprova idempotência, mas não demonstra uma instalação inicial.

## Usuário

nao tem uma interface grafica do ansible?

## Assistente

Vou conferir as opções de interface web para Ansible e como elas se encaixam na demonstração do desafio.

## Assistente

**Sim, existem interfaces web para executar Ansible**, instaladas separadamente:

- **[Semaphore UI](https://semaphoreui.com/docs/user-guide/apps/ansible):** permite selecionar um playbook, executá-lo pelo navegador e acompanhar os resultados.
- **[AWX](https://docs.ansible.com/projects/awx/en/latest/):** oferece gerenciamento de inventários, credenciais e execuções.

**No seu projeto, usamos Ansible pelo terminal.** O enunciado não exige interface gráfica: executar o comando e mostrar as tarefas e o resultado final atende à demonstração.

Para este desafio, eu manteria essa apresentação: **terminal para o Ansible e navegador para o Grafana**. Uma interface web seria um adicional ao escopo.

## Usuário

qual seria o mais simples de instalar?

## Assistente

O **[Semaphore UI](https://semaphoreui.com/docs)** seria o mais simples para esse projeto.

Ele permite executar o playbook pelo navegador, acompanhar os logs e consultar o histórico. Pode ser instalado com Docker, aproveitando o ambiente que já está funcionando na sua VM.

Eu escolheria **Semaphore** para esse laboratório. O AWX exige uma instalação e manutenção mais complexas.

## Usuário

qual serviço pra iniciar o grafana?

## Assistente

O serviço se chama **`grafana`**. Na VM, execute:

```bash
cd /opt/projeto-korp
docker compose up -d grafana
```

Depois abra **http://192.168.1.108:3001**.

Para conferir o estado:

```bash
docker compose ps grafana
```

## Usuário

GRAFANA\_ADMIN\_PASSWORD=change-this-before-running

## Usuário

EU QUERO UMA EXPLICAÇÃO ARQUIVO POR ARQUIVO, TODO FLUXO, COMO FOI FEITO

## Assistente

Vou ler a versão atual de todos os arquivos e explicar o caminho completo: build, rede, requisição HTTP, métricas, dashboard e provisionamento. Também vou salvar essa explicação fora do repositório, para você estudar antes da entrevista.

## Assistente

A versão atual tem 24 arquivos versionados. Vou explicar cada um, incluindo a diferença entre a rede bridge do VirtualBox e a do Docker, o que cada teste comprova e por que trocar apenas o `.env` não altera a senha já salva no Grafana.

## Assistente

Preparei uma explicação completa para você estudar: **[abrir guia detalhado do projeto](D:/lsk/korp-preparacao-entrevista/EXPLICACAO-COMPLETA.md)**.

Ele está **fora do repositório público**. Não alterei os arquivos do projeto nesta revisão.

Abaixo explico os **24 arquivos**, o fluxo completo e os ajustes realizados na implantação.

**1. Primeiro: o que o projeto faz**

O projeto entrega uma API em Go, acessada por um proxy NGINX, com métricas coletadas pelo Prometheus e visualizadas pelo Grafana. O Ansible automatiza a instalação e a subida desse ambiente.

| Componente | Responsabilidade |
|---|---|
| Rocky Linux na VM | Executar Docker e os contêineres |
| API em Go | Retornar o JSON solicitado e produzir métricas |
| NGINX | Receber as requisições externas e encaminhar para a API |
| Prometheus | Coletar e armazenar métricas |
| Grafana | Consultar o Prometheus e apresentar os gráficos |
| Docker Compose | Definir e executar os quatro contêineres |
| Ansible | Preparar o servidor, copiar configurações e iniciar a aplicação |
| GitHub Actions | Validar automaticamente o código e a integração |

Existem duas redes diferentes:

- **Bridge do VirtualBox:** coloca a VM na sua rede local, permitindo acesso pelo Windows.
- **Bridge do Docker:** permite a comunicação entre os contêineres dentro da VM.

Na implantação validada, a VM estava em `192.168.1.108`. A API era acessada pela porta `80`, e o Grafana pela `3001`, porque a `3000` já estava ocupada por outra aplicação.

---

**2. `cmd/server/main.go` — a aplicação**

Esse é o código principal da API.

Ele cria um servidor HTTP na porta interna `8080` e trata três caminhos:

| Caminho | Função |
|---|---|
| `/projeto-korp` | Retornar nome e horário atual |
| `/healthz` | Informar se o servidor HTTP está respondendo |
| `/metrics` | Expor métricas no formato do Prometheus |

Uma resposta de `/projeto-korp` tem este formato:

```json
{
  "nome": "Projeto Korp",
  "horario": "2026-09-09T15:30:00.123456789Z"
}
```

O horário é calculado **a cada requisição**. O código utiliza UTC e o formato `RFC3339Nano`; o `Z` indica UTC.

A estrutura `response` define os campos do JSON. As marcações `json:"nome"` e `json:"horario"` controlam os nomes enviados ao cliente.

A função `newHandler` configura as rotas e as métricas. Ela recebe uma função de relógio como parâmetro: na execução normal usa `time.Now`; nos testes, usa um horário controlado. Isso permite testar o horário sem depender do relógio real.

O tratamento das requisições funciona assim:

- `GET /projeto-korp`: retorna `200` e o JSON.
- Outro método nessa rota: retorna `405`, com `Allow: GET`.
- Caminho inexistente: retorna `404`.
- `/healthz` e `/metrics`: também aceitam somente `GET`.

A resposta principal utiliza `Content-Type: application/json` e `Cache-Control: no-store`, para evitar reaproveitamento de uma resposta com horário antigo.

As duas métricas da aplicação são:

```text
http_requests_total
http_request_duration_seconds
```

A primeira é um contador de requisições, separado por método, rota e status HTTP.

A segunda é um histograma de duração. Ele fornece os dados usados para calcular latência média e percentil 95 no Grafana.

As chamadas a `/healthz` e `/metrics` ficam fora dessas métricas de negócio. Assim, as verificações automáticas não aumentam artificialmente o volume de acesso à aplicação.

Rotas desconhecidas recebem o rótulo `unmatched`. Isso evita criar uma série diferente para cada URL aleatória, o que aumentaria desnecessariamente o consumo de memória do Prometheus.

Também são registradas métricas do processo e do runtime Go.

Os logs são escritos em JSON na saída padrão, incluindo método, rota, status e duração. O Docker captura essa saída.

O servidor possui limites de tempo para leitura, escrita e conexões ociosas. Também trata `SIGTERM` e interrupção para encerrar de forma controlada, dando até dez segundos para finalizar requisições.

Por fim, o mesmo executável aceita:

```bash
/http-server-projeto-korp healthcheck
```

Nesse modo, ele consulta o próprio `/healthz`. Isso permite verificar a saúde do contêiner sem instalar `curl` ou um shell na imagem da API.

**Como explicar na entrevista:** “A API foi feita em Go, retorna o horário atual em UTC, expõe métricas próprias e possui tratamento de rotas, logs estruturados e encerramento controlado.”

---

**3. `cmd/server/main_test.go` — testes da API**

Esse arquivo verifica três comportamentos principais.

**Resposta e horário:** confere status, cabeçalhos, nome, quantidade de campos e conversão para UTC. Faz duas chamadas com horários diferentes para comprovar que o horário não ficou fixo.

**Rotas e métricas:** verifica respostas `200`, `404` e `405`, o cabeçalho `Allow` e os contadores gerados. Também verifica que saúde e métricas não entram no contador da aplicação.

**Concorrência:** dispara cem requisições simultâneas e verifica se todas foram contabilizadas.

O comando:

```bash
go test -race -cover ./...
```

executa os testes, procura condições de corrida nos caminhos exercitados e informa cobertura.

Esses testes verificam o código Go. A integração com NGINX, Prometheus e Grafana é validada separadamente.

---

**4. `go.mod` — dependências do Go**

Define o módulo:

```text
http-server-projeto-korp
```

Também declara a versão do Go e as dependências.

A biblioteca principal adicionada é:

```text
github.com/prometheus/client_golang
```

Ela fornece contadores, histogramas e o handler que publica `/metrics`.

As dependências marcadas como `indirect` são utilizadas pelas bibliotecas importadas pelo projeto.

---

**5. `go.sum` — integridade das dependências**

Guarda hashes dos módulos e dos arquivos `go.mod` das dependências.

O Go usa esses registros para verificar a integridade do que foi baixado. Esse arquivo é gerado e atualizado pelas ferramentas do Go; não é uma lista escrita manualmente.

Ele complementa o `go.mod`: um declara dependências, o outro registra verificações de integridade.

---

**6. `Dockerfile` — construção da imagem da API**

Usa uma construção em duas etapas.

Na primeira:

```dockerfile
FROM golang:1.26.5-alpine AS build
```

O Docker baixa as dependências e compila o programa.

Copiar primeiro `go.mod` e `go.sum` permite reaproveitar o cache das dependências quando apenas o código muda.

A compilação utiliza:

```text
CGO_ENABLED=0
-trimpath
-ldflags="-s -w"
```

Essas opções desativam a dependência de CGO, removem caminhos locais do binário e reduzem informações de depuração.

Na segunda etapa:

```dockerfile
FROM scratch
```

A imagem final recebe somente o executável. Não contém o compilador, gerenciador de pacotes ou shell.

O processo roda como usuário `65532`, sem privilégios de root.

```dockerfile
EXPOSE 8080
```

documenta a porta interna. **Isso não publica a porta na VM.** A publicação depende do Compose, e a API não possui publicação direta.

O `HEALTHCHECK` executa o modo de verificação implementado no próprio programa.

---

**7. `.dockerignore` — o que pode entrar no build**

Ignora todos os arquivos e libera apenas:

```text
go.mod
go.sum
cmd/
```

Isso reduz o contexto de construção e evita enviar arquivos desnecessários ou segredos para o build.

Os arquivos de Ansible, Grafana e Prometheus não são necessários para compilar a API.

---

**8. `compose.yaml` — definição do ambiente**

É o arquivo que reúne os quatro serviços:

- `http-server-projeto-korp`
- `nginx`
- `prometheus`
- `grafana`

Todos participam da rede externa:

```text
projeto-korp-network
```

“Externa” significa que o Compose espera encontrar essa rede já criada. O Ansible faz essa criação.

Os serviços compartilham configuração de reinício e rotação dos logs. A política `unless-stopped` permite reiniciar processos que terminaram e recuperar os serviços com o Docker, salvo quando foram parados manualmente.

Um contêiner apenas marcado como `unhealthy` não é automaticamente reiniciado por essa política.

**API:** construída pelo Dockerfile, sem porta publicada. Usa sistema de arquivos somente leitura, remove capabilities e impede aquisição de novos privilégios.

**NGINX:** publica `80:80`, carrega sua configuração e aguarda a API ficar saudável antes de iniciar.

**Prometheus:** armazena métricas em volume e mantém sete dias de retenção. Sua porta é publicada assim:

```yaml
127.0.0.1:9090:9090
```

Portanto, o acesso publicado está limitado à própria VM. O Grafana consegue acessá-lo pela rede interna do Docker.

**Grafana:** utiliza:

```yaml
"${GRAFANA_PORT:-3000}:3000"
```

Na VM, configuramos a porta externa `3001`. Dentro do contêiner, ele continua atendendo na `3000`.

O Compose também desabilita cadastro de usuários e acesso anônimo.

Há dois volumes persistentes:

```text
prometheus-data
grafana-data
```

Eles preservam dados quando os contêineres são recriados. Removê-los explicitamente apaga essa persistência.

Os arquivos de configuração são montados separadamente. A opção `ro` significa somente leitura; `Z` ajusta a rotulagem para uso com SELinux.

---

**9. `.env.example` — exemplo de configuração**

Contém:

```dotenv
GRAFANA_ADMIN_PASSWORD=change-this-before-running
GRAFANA_PORT=3000
```

**`change-this-before-running` é um texto de exemplo**, indicando que o valor deve ser substituído.

Esse arquivo não comprova qual senha está em uso. Na implantação automatizada, o Ansible gera o `.env` utilizado pelo Compose.

Outro detalhe: a senha administrativa configurada pelo Grafana é aplicada na criação inicial. Se o banco persistente já existe, alterar somente essa variável não redefine a senha salva. Por isso foi necessário sincronizar a configuração e redefinir a senha da conta existente. [Documentação do Grafana](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)

---

**10. `.gitignore` — arquivos locais e segredos**

Impede o versionamento de itens como:

```text
.env
.secrets/
.venv/
ansible/inventory.ini
coverage.out
```

Assim, a senha real, o inventário local e o ambiente Python não são enviados normalmente ao GitHub.

Isso vale para arquivos ainda não rastreados. Adicionar algo ao `.gitignore` não remove automaticamente um arquivo já versionado nem seu histórico.

---

**11. `.gitattributes` — padronização entre Windows e Linux**

Define:

```text
* text=auto eol=lf
```

Padroniza arquivos de texto com quebras de linha `LF`.

Isso ajuda especialmente nos scripts que são editados no Windows e executados no Linux.

---

**12. `nginx/http-server-projeto-korp.conf` — entrada HTTP**

Configura o NGINX para escutar na porta `80`.

O destino interno é:

```text
http-server-projeto-korp:8080
```

Esse nome é resolvido pelo DNS interno do Docker. O arquivo utiliza o resolvedor `127.0.0.11`, permitindo atualizar a resolução quando o contêiner da API muda de IP.

A regra:

```nginx
location = /metrics {
    return 404;
}
```

bloqueia o acesso externo ao caminho de métricas pelo NGINX.

O Prometheus coleta diretamente da API pela rede Docker, portanto continua funcionando.

As demais requisições são encaminhadas para a API, junto de cabeçalhos como `Host`, `X-Real-IP` e `X-Forwarded-For`.

Também existem limites de tempo para conexão e comunicação com o backend.

**Como explicar:** “O NGINX centraliza o acesso externo; a API fica acessível somente na rede dos contêineres.”

---

**13. `monitoring/prometheus/prometheus.yml` — coleta**

Configura coleta e avaliação de regras a cada cinco segundos.

O alvo é:

```text
http-server-projeto-korp:8080
```

O caminho padrão da coleta é `/metrics`.

O Prometheus acessa esse endpoint periodicamente e guarda os valores ao longo do tempo.

Também carrega `alerts.yml`.

A métrica:

```promql
up{job="http-server-projeto-korp"}
```

é criada pelo próprio Prometheus:

- `1`: a coleta teve sucesso.
- `0`: a coleta falhou.

**Limite importante:** isso mede o sucesso da coleta direta da API. Não verifica todo o caminho entre o navegador, a rede e o NGINX.

---

**14. `monitoring/prometheus/alerts.yml` — regra de alerta**

Define o alerta `KorpServiceDown`.

A condição é:

```promql
up{job="http-server-projeto-korp"} == 0
```

com duração de trinta segundos.

Assim, uma falha precisa permanecer pelo período configurado antes de o alerta disparar.

A severidade é `critical`.

O projeto não configura Alertmanager ou envio de notificações. A regra pode aparecer no Prometheus, mas não envia mensagens por si só.

---

**15. `monitoring/grafana/provisioning/datasources/datasources.yml` — fonte dos dados**

Cadastra automaticamente o Prometheus no Grafana.

A URL é:

```text
http://prometheus:9090
```

O nome `prometheus` é resolvido dentro da rede Docker.

A fonte recebe o identificador fixo:

```text
prometheus
```

O dashboard referencia esse identificador para saber onde executar suas consultas.

A conexão ocorre pelo servidor Grafana. Seu navegador não precisa acessar diretamente a porta `9090`.

---

**16. `monitoring/grafana/provisioning/dashboards/dashboards.yml` — carregamento do painel**

Instrui o Grafana a procurar dashboards em:

```text
/var/lib/grafana/dashboards
```

Cria a pasta `Projeto Korp` e configura o carregamento dos arquivos.

O painel fica controlado pelos arquivos de provisionamento, com edição pela interface desabilitada.

**Para a avaliação:** o dashboard foi provisionado automaticamente. A demonstração consiste em mostrar o arquivo de definição, executar o projeto e abrir o painel carregado no Grafana.

---

**17. `monitoring/grafana/dashboards/http-server-projeto-korp-dashboard.json` — os oito painéis**

Define o dashboard, incluindo identificação, posição dos gráficos, consultas, unidades e atualização.

Seu UID é:

```text
projeto-korp
```

Por isso pode ser acessado por:

```text
http://192.168.1.108:3001/d/projeto-korp
```

O período inicial é de quinze minutos, com atualização a cada cinco segundos.

| Painel | O que apresenta |
|---|---|
| Disponibilidade atual | Último valor de `up` |
| Disponibilidade em uma hora | Percentual de amostras com coleta bem-sucedida |
| Volume de requisições | Aumento do contador no período selecionado |
| Latência P95 | Estimativa de duração abaixo da qual ficam 95% das requisições |
| Requisições por segundo | Taxa de requisições, agrupada por status |
| Histórico de disponibilidade | Evolução de `up` |
| Volume por status | Requisições separadas por código HTTP |
| Latência média | Soma das durações dividida pela quantidade de observações |

As funções principais são:

- `rate`: calcula a taxa média de crescimento de um contador por segundo.
- `increase`: estima o crescimento no intervalo.
- `avg_over_time`: calcula a média das amostras.
- `histogram_quantile`: estima um percentil usando os buckets do histograma.

Um volume como `23,1` pode aparecer porque `increase` extrapola para o intervalo consultado. Não significa que a API recebeu uma fração de requisição. [Documentação do Prometheus](https://prometheus.io/docs/prometheus/3.12/querying/functions/)

Com pouco tráfego, painéis de latência podem ficar vazios. O P95 também é uma estimativa limitada pela distribuição dos buckets.

---

**18. `ansible/inventory.example.ini` — servidores de destino**

Mostra como declarar uma máquina no grupo:

```ini
[korp]
servidor ansible_host=192.0.2.10 ansible_user=ubuntu
```

Esse endereço é ilustrativo.

Na execução feita dentro da própria VM, o inventário real utiliza:

```ini
[korp]
localhost ansible_connection=local
```

Nesse caso, o Ansible configura a máquina local, sem conexão SSH consigo mesmo.

O inventário real é ignorado pelo Git.

---

**19. `ansible/requirements.yml` — módulos adicionais**

Fixa a collection:

```text
community.docker 4.8.1
```

Ela fornece os módulos usados para criar a rede Docker e executar Docker Compose.

A instalação é feita com `ansible-galaxy`.

Essa collection é uma dependência da automação, enquanto `go.mod` descreve dependências da aplicação.

---

**20. `ansible/playbook.yml` — automação principal**

Esse arquivo coordena a instalação inteira.

Executa no grupo `korp` com privilégios administrativos por meio de `become: true`.

O fluxo é:

1. **Coletar informações do servidor.** Identifica distribuição, versão e arquitetura.
2. **Validar compatibilidade.** Aceita Ubuntu 24.04 ou Rocky Linux 9/10 e as arquiteturas previstas.
3. **Verificar pacotes conflitantes.** Interrompe se encontrar determinados pacotes que podem conflitar com a instalação do Docker.
4. **Carregar as tarefas da distribuição.** Seleciona `docker-rocky.yml` ou `docker-ubuntu.yml`.
5. **Iniciar e habilitar o Docker.**
6. **Criar `/opt/projeto-korp`.**
7. **Copiar os arquivos necessários à aplicação.**
8. **Obter uma senha persistente para o Grafana.** A senha é mantida em arquivo privado para não mudar a cada execução.
9. **Criar o `.env`.** Com senha e porta; permissão `0600` e conteúdo ocultado nos logs.
10. **Criar a rede bridge `projeto-korp-network`.**
11. **Executar o Docker Compose.** Reconstrói e recria quando os arquivos copiados mudam, aguardando os serviços ficarem saudáveis.
12. **Verificar a API.** Confere status, nome e formato do JSON.
13. **Verificar o Prometheus.** Confere se o alvo está com `up=1`.
14. **Verificar o Grafana.** Autentica e confirma que o dashboard existe.
15. **Exibir informações de acesso.**

A ideia é **idempotência**: repetir a execução sem mudanças deve manter o ambiente como está.

Na última validação realizada, o resultado foi:

```text
ok=21 changed=0 unreachable=0 failed=0
```

Isso demonstra que aquela execução reconheceu o estado esperado sem aplicar alterações.

Na verificação do Grafana, respostas `401` ou `403` interrompem novas tentativas para evitar insistência com credenciais inválidas. Elas continuam representando falha; não são consideradas autenticação bem-sucedida.

---

**21. `ansible/tasks/docker-rocky.yml` — instalação no Rocky**

Instala pré-requisitos:

```text
ca-certificates
gnupg2
python3-libselinux
python3-requests
```

Depois importa a chave GPG, configura o repositório de pacotes do Docker e instala:

```text
docker-ce
docker-ce-cli
containerd.io
docker-buildx-plugin
docker-compose-plugin
```

As funções são:

- Docker Engine: executar contêineres.
- Docker CLI: disponibilizar o comando `docker`.
- containerd: gerenciar o runtime usado pelo Docker.
- Buildx: construção de imagens.
- Compose: executar a definição de serviços.

Na implantação, foram necessários ajustes nos pré-requisitos: `gnupg2` para a operação com a chave e `python3-requests` para os módulos usados na automação.

O SELinux permaneceu em modo `Enforcing` na validação.

---

**22. `ansible/tasks/docker-ubuntu.yml` — instalação no Ubuntu**

Cumpre a mesma finalidade usando APT.

Instala os pré-requisitos, cria o diretório de chaves, baixa a chave do repositório e gera um arquivo de fonte no formato `deb822`.

O repositório utiliza a versão `noble`, correspondente ao Ubuntu 24.04, e a arquitetura identificada pelo Ansible.

Depois instala os mesmos componentes do Docker.

**Limite da validação:** a implantação real descrita foi feita no Rocky. A existência desse arquivo não equivale a uma instalação completa já demonstrada em uma VM Ubuntu.

---

**23. `scripts/load.sh` — geração de tráfego**

Envia requisições sequenciais para a API.

Exemplo:

```bash
sh scripts/load.sh http://localhost/projeto-korp 300
```

Faz trezentas chamadas, com pausa de `0.2` segundo entre elas.

O objetivo é gerar dados para observar contadores e gráficos.

Não é um teste de capacidade máxima: não cria carga concorrente e a taxa depende também do tempo de resposta.

---

**24. `scripts/smoke.py` — teste integrado**

Verifica o ambiente depois de iniciado.

Ele:

- Consulta a API duas vezes.
- Confere nome, campos e horário.
- Verifica se o horário muda e está próximo do relógio atual.
- Confirma que `/metrics` retorna `404` pela entrada pública.
- Consulta o Prometheus e procura `up=1`.
- Autentica no Grafana.
- Confirma a existência do dashboard e de pelo menos seis painéis.

O dashboard atual possui oito painéis.

A senha é recebida por variável de ambiente, sem ficar escrita no script.

Esse teste valida respostas das APIs. A renderização visual dos gráficos precisa ser observada no navegador, como foi feito na validação anterior.

---

**25. `.github/workflows/ci.yml` — validação no GitHub**

Esse é o último dos 24 arquivos; a numeração acima começou pela visão geral.

O workflow executa em `push` e `pull_request`.

As etapas são:

1. Baixar o código.
2. Preparar o Go.
3. Verificar formatação com `gofmt`.
4. Executar análise com `go vet`.
5. Executar testes com detector de corrida e cobertura.
6. Instalar Ansible e a collection Docker.
7. Verificar a sintaxe do playbook.
8. Gerar uma senha temporária para os testes.
9. Criar a rede bridge.
10. Validar e subir o Compose.
11. Verificar configurações do NGINX e Prometheus.
12. Executar `smoke.py`.
13. Confirmar que a API não tem portas publicadas.
14. Mostrar logs se houver falha.
15. Remover o ambiente temporário ao terminar.

A checagem de publicação consulta `HostConfig.PortBindings` do contêiner. Isso verifica a configuração de portas no host, sem confundir com `EXPOSE`.

**O alcance da CI:** ela testa código e integração no runner do GitHub. A etapa de Ansible verifica sintaxe; não executa toda a instalação em uma VM limpa.

---

**O caminho completo de uma requisição**

Quando você abre:

```text
http://192.168.1.108/projeto-korp
```

acontece o seguinte:

1. O Windows envia a requisição para o IP da VM.
2. A interface bridge do VirtualBox entrega o tráfego ao Rocky.
3. A porta `80` publicada pelo Docker direciona a conexão para o NGINX.
4. O NGINX resolve o nome `http-server-projeto-korp` na rede Docker.
5. Encaminha a requisição para a porta interna `8080`.
6. A API identifica a rota e o método.
7. Calcula o horário atual em UTC.
8. Escreve o JSON da resposta.
9. Registra contador, duração e log.
10. A resposta retorna pelo NGINX ao navegador.

A API não consulta o Grafana nem o Prometheus para responder.

**O caminho completo de uma métrica**

1. Uma requisição atualiza as métricas em memória na API.
2. A cada cinco segundos, o Prometheus consulta `/metrics` diretamente.
3. Armazena as amostras com seus horários.
4. Avalia também a regra de alerta.
5. O Grafana executa as consultas PromQL configuradas no dashboard.
6. O Prometheus devolve os resultados.
7. O Grafana apresenta os números e gráficos no navegador.

Portanto, o Grafana mostra dados armazenados no Prometheus, e a atualização visual depende dos intervalos de coleta e atualização.

**Como a implantação foi feita e ajustada**

A solução foi organizada em camadas: aplicação e testes, imagem Docker, serviços no Compose, configurações de monitoramento, automação Ansible e validação no GitHub.

Na implantação real:

- Foi identificado o endereço atualizado da VM, `192.168.1.108`.
- A conectividade da interface bridge foi recuperada.
- O Docker foi instalado pelo fluxo do Rocky.
- Os pré-requisitos ausentes foram incorporados à automação.
- O Grafana passou a usar a porta externa `3001`, pois `3000` já estava ocupada.
- A senha da conta existente foi alinhada com a configuração.
- As verificações de autenticação e de portas publicadas foram corrigidas.
- O playbook foi repetido para verificar idempotência.
- API, coleta e dashboard foram validados.

Na última verificação, os quatro contêineres estavam saudáveis, o alvo do Prometheus estava com `up=1` e o dashboard apresentava métricas. Isso descreve a validação anterior, não uma nova consulta à VM nesta resposta.

**Como demonstrar na entrevista**

Na VM, execute:

```bash
cd /root/projeto-korp

.venv/bin/ansible-playbook \
  -i ansible/inventory.ini \
  ansible/playbook.yml \
  -e grafana_port=3001
```

Explique que `/root/projeto-korp` contém o código usado pela automação, enquanto `/opt/projeto-korp` recebe os arquivos implantados.

Depois mostre os serviços:

```bash
cd /opt/projeto-korp
docker compose ps
```

Demonstre a resposta:

```bash
curl http://localhost/projeto-korp
```

Repita para mostrar a mudança do horário.

Gere tráfego a partir do repositório:

```bash
cd /root/projeto-korp
sh scripts/load.sh http://localhost/projeto-korp 300
```

Abra no Windows, se a VM continuar com o mesmo IP:

```text
http://192.168.1.108:3001/d/projeto-korp
```

Mostre o crescimento do volume, a taxa de requisições, os status HTTP e as latências.

Uma explicação oral que acompanha essa demonstração é:

> “O Ansible prepara o servidor e inicia quatro serviços definidos no Docker Compose. O NGINX recebe o acesso externo e encaminha para a API Go, que retorna o nome do projeto e o horário atual em UTC. A API também publica métricas na rede interna. O Prometheus coleta essas métricas, e o Grafana carrega automaticamente um dashboard definido em arquivo. Os testes verificam a aplicação e a integração, e uma segunda execução do playbook confirma que o ambiente permanece no estado esperado.”

## Usuário

cara, como eu explicaria isso numa entrevista?

## Assistente

Você pode explicar como uma história: **qual era o objetivo, como você organizou a solução, como comprova que funciona e quais dificuldades resolveu.** Não precisa recitar os 24 arquivos.

Uma apresentação de dois a três minutos seria assim:

> “O objetivo do projeto era colocar uma aplicação HTTP em funcionamento, automatizar a instalação e demonstrar o monitoramento.
>
> A aplicação está em Go e responde na rota `/projeto-korp`, retornando o nome do projeto e o horário atual em UTC. Cada requisição calcula um horário novo.
>
> Eu organizei o ambiente em quatro contêineres: aplicação, NGINX, Prometheus e Grafana. O Docker Compose descreve como esses serviços sobem e se comunicam.
>
> O NGINX é a entrada da aplicação. Ele recebe a requisição na porta 80 e encaminha para a API pela rede interna do Docker. A API não tem uma porta publicada diretamente na VM.
>
> Para o monitoramento, a aplicação expõe contadores de requisições e duração das respostas. O Prometheus coleta esses dados a cada cinco segundos, e o Grafana apresenta disponibilidade da coleta, volume de acessos, códigos de resposta e latência.
>
> O dashboard é provisionado por arquivos. Então ele aparece automaticamente quando o ambiente sobe, sem precisar montar os painéis manualmente.
>
> A instalação é automatizada pelo Ansible: ele verifica o sistema operacional, instala o Docker, copia os arquivos, configura a rede, inicia os contêineres e verifica a aplicação e o monitoramento.
>
> Também existem testes da API e uma pipeline no GitHub Actions que sobe o ambiente e verifica a integração.”

Use essa fala como base, com suas palavras e descrevendo honestamente sua participação.

**Na demonstração, fale enquanto mostra**

**1. Mostre a automação:**

> “Vou executar o playbook para mostrar como o servidor chega ao estado definido pelo projeto.”

```bash
cd /root/projeto-korp
.venv/bin/ansible-playbook -i ansible/inventory.ini ansible/playbook.yml -e grafana_port=3001
```

Quando terminar, explique o resultado que realmente aparecer:

> “Aqui vejo quais tarefas passaram, quais precisaram alterar alguma coisa e se houve falhas. Quando nada mudou na configuração, o esperado é uma execução sem alterações. Isso é idempotência.”

**2. Mostre os contêineres:**

```bash
cd /opt/projeto-korp
docker compose ps
```

> “Aqui estão os quatro serviços. Os healthchecks verificam se eles estão respondendo.”

**3. Mostre a aplicação:**

```bash
curl http://localhost/projeto-korp
```

Execute duas vezes:

> “A resposta tem os dois campos solicitados. O horário muda entre as chamadas porque é calculado a cada requisição.”

**4. Gere tráfego e abra o Grafana:**

```bash
cd /root/projeto-korp
sh scripts/load.sh http://localhost/projeto-korp 300
```

> “Agora estou gerando acessos para mostrar o comportamento das métricas. Depois da coleta do Prometheus, o volume e a taxa de requisições aparecem no dashboard.”

No navegador, se o IP continuar o mesmo:

```text
http://192.168.1.108:3001/d/projeto-korp
```

**Prepare estas respostas para as perguntas mais prováveis**

| Pergunta | Resposta que você pode dar |
|---|---|
| Por que usar NGINX? | “Para centralizar a entrada HTTP e encaminhar as requisições para a API, que fica na rede interna.” |
| Qual a diferença entre Compose e Ansible? | “O Compose define os contêineres. O Ansible prepara o servidor e executa a implantação, incluindo o Compose.” |
| Prometheus e Grafana fazem a mesma coisa? | “O Prometheus coleta e armazena as métricas. O Grafana consulta esses dados e apresenta os gráficos.” |
| O que é idempotência? | “Poder repetir a automação e manter o estado esperado, sem fazer alterações desnecessárias.” |
| Por que o Grafana está na porta 3001? | “A porta 3000 da VM já estava ocupada. Configurei 3001 externamente; dentro do contêiner continua sendo 3000.” |
| O dashboard foi criado manualmente? | “Ele está definido em JSON e é carregado pelo provisionamento do Grafana.” |
| O que acontece ao recriar os contêineres? | “Os dados do Grafana e do Prometheus ficam em volumes e permanecem, desde que os volumes não sejam removidos.” |
| O que significa `up = 1`? | “Que o Prometheus conseguiu coletar as métricas da API. Isso não garante, sozinho, que todo o acesso pelo NGINX está funcionando.” |
| O que é P95? | “É uma estimativa do tempo abaixo do qual ficaram 95% das requisições observadas.” |

**Se perguntarem sobre dificuldades**

Você tem exemplos concretos:

> “Na implantação no Rocky, precisei ajustar dependências usadas pela instalação e pelos módulos do Ansible. Também havia um conflito na porta 3000, então deixei a porta externa do Grafana configurável. Outro ponto foi a senha: alterar a variável de ambiente não redefinia a conta já criada no banco persistente do Grafana, então foi necessário alinhar a configuração com a conta existente.”

Explique cada caso em três partes: **o sintoma, a causa e a correção**.

**Se perguntarem o que melhoraria**

> “Para produção, eu acrescentaria HTTPS, uma gestão de segredos mais robusta, backup dos volumes, envio de alertas e uma verificação externa que testasse o caminho completo pelo NGINX.”

E, se não souber algum detalhe, pode responder:

> “Esse ponto eu ainda não aprofundei. Consigo mostrar como está configurado neste projeto e explicar o comportamento que validei.”

O mais importante é conseguir acompanhar uma requisição: **navegador → NGINX → API**, e depois uma métrica: **API → Prometheus → Grafana**. Isso dá uma base para explicar o restante sem decorar o código inteiro.

