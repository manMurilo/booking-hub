# Fluxo Conversacional

## Princípio fundamental

A IA interpreta a mensagem do cliente.

O backend controla o fluxo da conversa.

A IA não decide ações de negócio, não escolhe valores para o cliente e não deve inventar informações.

O backend é responsável por determinar:

- qual trilha está sendo executada;
- qual etapa está pendente;
- quais dados já foram obtidos;
- quais dados ainda são necessários;
- quando consultar a Trinks;
- quando executar uma operação;
- quando solicitar confirmação do cliente;
- quando encaminhar para atendimento humano.

A Trinks é a fonte de verdade para os dados operacionais.

---

# 1. Identificação do cliente

A primeira chave de identificação do cliente é o número de telefone utilizado na conversa do WhatsApp.

Ao receber uma mensagem:

1. extrair o telefone do remetente;
2. consultar o cliente na Trinks pelo telefone;
3. se encontrado, considerar o cliente identificado;
4. utilizar o primeiro nome retornado pela Trinks durante o atendimento.

Exemplo:

> Olá, Murilo! Como posso te ajudar?

A identificação por telefone é suficiente.

A base da Trinks não permite múltiplos clientes cadastrados com o mesmo número de telefone.

---

# 2. Cliente não identificado

Não encontrar um cliente não significa que a conversa deve ser interrompida.

A necessidade de identificação depende da intenção.

## 2.1 Operação que exige cliente

Se a intenção exigir um `clienteId`, como um agendamento:

```text
Cliente não encontrado
        ↓
Verificar se já é cliente
        ↓
"Você já é cliente?"
Se o cliente responder que não:

Pedir nome + CPF
        ↓
Telefone já conhecido
        ↓
Criar cliente na Trinks
        ↓
Cliente identificado
        ↓
Retomar a intenção original

Dados obrigatórios para cadastro:

nome;
CPF;
telefone.

O telefone não precisa ser solicitado novamente, pois já foi obtido através do WhatsApp.

Mensagem sugerida:

Claro! Antes de continuar, você já é cliente?

Se responder que não:

Sem problema! Para darmos continuidade ao agendamento, me passe seu nome completo e CPF, por favor.

3. Cliente identificado

Quando o cliente for encontrado pelo telefone, o estado da conversa deve manter sua identificação.

O sistema não deve consultar/criar novamente o cliente desnecessariamente a cada mensagem.

O estado deve preservar:

clienteId;
nome;
telefone;
demais dados relevantes retornados pela Trinks.
4. Interpretação da intenção

A IA deve interpretar a intenção da mensagem.

As trilhas iniciais são:

BOOKING — agendamento;
INQUIRY — dúvida ou informação;
SUPPORT — problema relacionado a algo existente;
UNKNOWN — não foi possível identificar a intenção.

A IA deve retornar a interpretação e os dados identificados.

O backend decide o próximo passo.

5. BOOKING — Agendamento

Esta é a primeira trilha operacional prioritária.

O objetivo é conduzir o cliente até um agendamento confirmado na Trinks.

5.1 Dados necessários

Um agendamento pode exigir dados como:

cliente;
serviço;
data;
horário;
profissional, quando aplicável.

Os valores devem ser obtidos através da conversa e/ou consultas à Trinks.

A IA nunca deve inventar ou escolher esses valores pelo cliente.

6. Cliente já identificado + agendamento

Exemplo:

Oi, quero agendar um corte.

O backend sabe:

cliente = identificado
intenção = BOOKING
serviço = não informado

Deve perguntar somente o dado necessário:

Claro! Qual serviço você gostaria de agendar?

Se o cliente informar:

Um corte amanhã.

A IA interpreta:

serviço = corte
data = amanhã

O backend preserva esses dados e identifica o próximo dado necessário.

Não perguntar novamente algo que o cliente já informou.

7. Cliente não identificado + agendamento

Exemplo:

Oi, quero agendar um corte amanhã às 9.

Primeiro:

identificar telefone

Se o cliente não for encontrado:

BOOKING
+
cliente não identificado

Iniciar a triagem:

Você já é cliente?

Se não for:

pedir nome + CPF
        ↓
criar cliente
        ↓
retomar BOOKING

O contexto original do agendamento não deve ser perdido.

Exemplo:

serviço = corte
data = amanhã
horário = 09:00

Esses dados continuam no ConversationState enquanto o cadastro é realizado.

8. Não repetir perguntas

A IA pode receber várias informações em uma única mensagem.

Exemplo:

Quero um corte amanhã às 9.

O sistema deve aproveitar:

serviço = corte
data = amanhã
horário = 09:00

Não deve perguntar novamente esses dados.

Outro exemplo:

Quero cortar o cabelo amanhã às 9 com o João.

A IA deve extrair os dados disponíveis.

O backend valida esses dados contra a Trinks.

Somente o que estiver faltando deve ser solicitado.

9. Valores escolhidos pelo cliente

A IA não pode decidir pelo cliente.

Exemplos:

não escolher profissional;
não escolher horário;
não escolher serviço;
não escolher data;
não confirmar agendamento sem autorização.

Se houver múltiplas opções disponíveis, elas devem ser apresentadas ao cliente para escolha.

10. Disponibilidade

A disponibilidade deve ser consultada diretamente na Trinks.

Nunca assumir que um horário está disponível.

Exemplo:

Cliente:

Amanhã às 9.

Backend:

consultar Trinks

Se estiver disponível:

informar disponibilidade
pedir confirmação

Se não estiver:

consultar opções disponíveis
apresentar opções ao cliente
aguardar escolha
11. Confirmação do agendamento

Mesmo quando todos os dados estiverem preenchidos, o agendamento não deve ser criado automaticamente.

Fluxo:

Dados completos
      ↓
Consultar disponibilidade
      ↓
Disponível
      ↓
Apresentar resumo
      ↓
Solicitar confirmação
      ↓
Cliente confirma
      ↓
Criar agendamento na Trinks

O backend só deve executar a criação após confirmação explícita do cliente.

12. INQUIRY — Dúvidas e informações

Dúvidas que não exigem identificação do cliente podem ser respondidas normalmente.

Exemplo:

Vocês têm estacionamento?

Resposta:

Não temos estacionamento próprio, mas existem algumas vagas públicas na rua.

Não solicitar cadastro apenas para responder uma dúvida.

13. Informações dinâmicas

Não responder com informações fixas quando a informação puder variar.

Devem ser consultadas na Trinks:

serviços;
valores;
duração;
profissionais;
disponibilidade;
planos;
assinaturas;
informações relacionadas ao cadastro.

A Trinks é a fonte de verdade.

14. Planos e assinaturas

A Crazy Dog Barber possui planos e assinaturas.

Quando o cliente solicitar informações sobre eles, consultar as informações disponíveis na Trinks.

Questões financeiras devem ser direcionadas:

ao portal da Trinks; ou
à equipe da barbearia presencialmente.

Portal:

https://www.trinks.com/crazydog

15. SUPPORT — Problemas

Problemas relacionados a agendamentos ou dados existentes devem ser tratados como SUPPORT.

Exemplos:

Meu agendamento sumiu.

Não consigo cancelar meu horário.

Marcaram meu horário errado.

Quando a operação exigir identificação, utilizar o cliente identificado pelo telefone.

Se for necessário consultar dados existentes, utilizar a Trinks.

16. Mudança de assunto

O cliente pode mudar temporariamente de assunto durante uma operação.

Exemplo:

Cliente:

Quero agendar um corte amanhã.

Bot:

Qual horário você prefere?

Cliente:

Vocês funcionam domingo?

A nova mensagem pode ser interpretada como INQUIRY.

O sistema deve:

preservar o agendamento em andamento;
responder a dúvida;
retornar à operação anterior.

Exemplo:

Sim, funcionamos aos domingos das 9h às 14h. Sobre seu agendamento de amanhã, qual horário você prefere?

O contexto da operação pendente nunca deve ser perdido por uma dúvida intermediária.

17. UNKNOWN — Não entendido

Quando a IA não conseguir determinar a intenção:

Primeira ocorrência:

Não consegui entender exatamente o que você precisa. Pode me explicar um pouco melhor?

Se continuar sem entendimento, tentar esclarecer novamente.

Após repetidas falhas:

Desculpe, não consegui entender como posso te ajudar. Quer falar com uma atendente?

18. Solicitação fora das capacidades

Se a IA entender a solicitação, mas ela estiver fora das capacidades implementadas:

UNSUPPORTED

Não inventar uma resposta.

Informar que não consegue realizar aquela solicitação e oferecer atendimento humano.

Exemplo:

No momento não consigo te ajudar com isso. Quer falar com uma atendente?

19. Atendimento humano

O atendimento humano será uma saída válida da conversa.

Quando o cliente solicitar uma atendente ou o sistema determinar que a solicitação não pode ser resolvida automaticamente:

handoff = HUMAN

Futuramente esse estado deverá disparar uma notificação para a equipe através de uma extensão integrada ao backend.

A extensão poderá emitir um alerta sonoro no computador da equipe.

20. ConversationState

O ConversationState representa o trabalho atual da conversa, e não somente o histórico de mensagens.

Deve preservar informações como:

cliente
intenção
estágio
dados de agendamento
ação pendente
histórico

Exemplo:

intention = BOOKING


client:
  identified = true
  id = 123
  name = Murilo


scheduling:
  service = corte
  date = 2026-08-16
  time = null
  professional = null


pendingAction = ASK_TIME
21. Responsabilidade da IA

A IA é responsável por:

entender linguagem natural;
identificar intenção;
extrair informações fornecidas pelo cliente;
interpretar respostas;
identificar mudança temporária de assunto;
identificar dúvidas;
identificar solicitações fora do escopo.

A IA não é responsável por:

escolher dados pelo cliente;
inventar disponibilidade;
inventar serviços;
inventar preços;
criar agendamentos diretamente;
decidir quando uma operação deve ser executada;
substituir validações do backend.
22. Responsabilidade do backend

O backend é responsável por:

identificar o cliente;
controlar o estado;
controlar a trilha;
determinar dados pendentes;
consultar a Trinks;
validar dados;
executar operações;
solicitar confirmação;
preservar contexto;
controlar mudança de assunto;
encaminhar para atendimento humano.
23. Princípio geral

A conversa deve ser conduzida pelo estado real da operação.

Não perguntar novamente o que o cliente já informou.

Não assumir informações que não foram fornecidas.

Não executar operações sem confirmação quando a operação exigir confirmação.

Não confiar na IA para regras de negócio.

Não utilizar dados estáticos quando a informação operacional estiver disponível na Trinks.

A IA interpreta.

O backend decide.

A Trinks valida e executa.




**Eu considero esses dois documentos suficientes para a próxima etapa.**

E tem uma vantagem importante: eles já deixam explícito que **não vamos transformar o prompt da IA em uma máquina de negócio**. O Gemini pode continuar sendo substituído futuramente sem termos que reescrever a lógica do atendimento.
