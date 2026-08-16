# Contexto Conversacional Atual do Projeto

Este documento reúne o contexto técnico e comportamental do fluxo de mensagens do WhatsApp e do sistema de conversa atual, para servir de referência durante validação com outra IA ou revisão manual.

> **Status em 16/08/2026:** as limitações descritas nas seções de diagnóstico sobre reconhecimento de agendamento, transição do orquestrador e execução de Booking foram corrigidas. O documento permanece como histórico das causas e regras que motivaram a implementação; para o estado vigente, consulte `README.md` e `docs/contexto-geral-da-aplicacao.md`.

## Visão Geral

O projeto recebe mensagens do WhatsApp, interpreta a intenção do cliente, atualiza o contexto de conversa e decide o próximo passo pelo orquestrador conversacional.

A arquitetura atual inclui:

- WhatsAppService: recebe mensagens e coordena o processamento do turno
- DeterministicMessageInterpreter: interpreta a mensagem e extrai dados estruturados
- MessageContextUpdaterService: atualiza o ConversationContext a partir da mensagem interpretada
- ConversationFlowOrchestrator: decide o próximo passo no fluxo conversacional
- ConversationStateService: persiste o estado da conversa e converte para/desde ConversationContext

## Fluxo esperado da conversa

O fluxo desejado, em linhas gerais, é:

1. Usuário envia mensagem
2. WhatsAppService processa a mensagem
3. MessageInterpreter interpreta a intenção
4. MessageContextUpdater atualiza o ConversationContext
5. ConversationFlowOrchestrator determina a próxima ação
6. Ação executada (perguntar, confirmar, consultar, etc.)
7. Estado persistido em ConversationState

## Estrutura de intenção e contexto

### ConversationIntent
Os valores esperados incluem:

- BOOKING
- INQUIRY
- SUPPORT
- UNKNOWN

### ConversationStep
O estado de conversa possui etapas como:

- INITIAL
- AWAITING_INTENTION
- CLIENT_IDENTIFICATION
- BOOKING_SERVICE_SELECTION
- BOOKING_PROFESSIONAL_SELECTION
- BOOKING_DATE_SELECTION
- BOOKING_AVAILABILITY_CONSULTATION
- BOOKING_TIME_SELECTION
- BOOKING_CONFIRMATION
- FINISHED

## Como a mensagem entra no sistema

### 1) Recebimento no WhatsApp

O fluxo começa em `WhatsAppService.processTurn()`.

Esse método:

- recupera o estado da conversa
- converte para `ConversationContext`
- itera sobre cada mensagem do lote
- chama `messageInterpreter.interpret(message.text)`
- chama `messageContextUpdater.updateContextFromStructuredMessage(context, structuredMessage)`
- envia o contexto atualizado para `conversationFlowOrchestrator.determineNextStep()`

### 2) Interpretação textual

O `DeterministicMessageInterpreter` aplica:

- normalização de texto
- lowercase
- remoção de acentos
- limpeza de espaços duplicados

Depois disso, ele chama `detectIntent()` e extrai dados estruturados como:

- service
- professional
- date
- time
- period
- confirmation
- cancellation
- rawText
- normalizedText
- missingFields

## Regra atual de detecção de intenção

A lógica atual tenta identificar agendamento com uma regex que considera termos como:

- "agendar"
- "marcar"
- "reservar"
- "quero agendar"
- "gostaria de agendar"
- "preciso agendar"

Mas a lógica atual pode falhar em frases como:

- "fazer um agendamento"
- "agendamento"
- "quero marcar um horário"

porque o padrão foi escrito de forma incompleta ou restritiva.

## Problema real observado

### Cenário reproduzido

Mensagem 1:

- "oi"

Resposta esperada:

- "Olá! Como posso te ajudar?"

Esse caso já funciona.

Mensagem 2:

- "qeuria cortar o cabelo"

Resposta observada:

- "Olá! Como posso te ajudar?"

Esse caso não produz intenção clara e permanece em AWAITING_INTENTION.

Mensagem 3:

- "fazer um agendamento"

Comportamento quebrado:

- não sai de AWAITING_INTENTION
- continua com intent UNKNOWN ou sem avançar

Mensagem 4:

- "quero agendar"

Comportamento esperado:

- deve entrar em BOOKING

Mensagem 5:

- "quero marcar um horário"

Comportamento esperado:

- deve entrar em BOOKING

## Caminho do processamento da mensagem

### Exemplo: "fazer um agendamento"

Fluxo esperado:

"fazer um agendamento"
        ↓
MessageInterpreter.interpret()
        ↓
StructuredMessage
        ↓
MessageContextUpdater.updateContextFromStructuredMessage()
        ↓
ConversationContext
        ↓
ConversationFlowOrchestrator

### O que deveria acontecer

O MessageInterpreter deveria retornar:

- intent = BOOKING

Em seguida, o MessageContextUpdater deve atualizar o `ConversationContext` para:

- intent = BOOKING
- previousIntent = intent anterior, se houver
- booking com dados mínimos que vieram na mensagem

Depois disso, o orchestrator deveria sair de `AWAITING_INTENTION` e seguir o fluxo de agendamento.

## O que o sistema estava fazendo no problema observado

O fluxo quebrado envolve estes pontos:

1. A mensagem é recebida pelo WhatsAppService
2. O MessageInterpreter tenta classificar a intenção
3. Se a intenção não for reconhecida, o structuredMessage fica com `intent = UNKNOWN`
4. O MessageContextUpdater preserva a intent atual quando a nova intent é UNKNOWN
5. O ConversationContext continua com `intent = UNKNOWN`
6. O ConversationFlowOrchestrator continua em `AWAITING_INTENTION`
7. O bot repete a mensagem inicial

## Como o MessageContextUpdater se comporta

O atualizador aplica estas regras:

- se `structuredMessage.intent !== UNKNOWN`, atualiza `updated.intent`
- if intent == UNKNOWN, preserva o valor atual
- se `structuredMessage.intent === BOOKING`, faz merge em `updated.booking`
- se há dados de cliente, atualiza cliente
- se houver confirmação ou cancelamento, registra no booking/metadata

Isso significa que, se o interpretador retornar `UNKNOWN`, o contexto não muda e o fluxo não avança.

## Importante sobre a causa raiz

O problema não está necessariamente no atualizador de contexto quando ele recebe uma intenção válida. O problema real é que a intenção válida não está sendo produzida corretamente no interpretador para algumas frases do tipo agendamento.

Em outras palavras:

- Se `StructuredMessage.intent === BOOKING`, o updater pode funcionar corretamente
- Se `StructuredMessage.intent === UNKNOWN`, o problema é do interpretador

## Fluxo de decisão do orquestrador

O `ConversationFlowOrchestrator.determineNextStep()` verifica o estado do contexto e encaminha para regras específicas:

- se `context.step === INITIAL` -> chama `handleInitialStep()`
- se `context.step === AWAITING_INTENTION` -> chama `handleIntentionStep()`
- se `context.intent === BOOKING` -> entra no fluxo de agendamento

### Relevante para o problema

Quando a intent continua em `UNKNOWN`, o orquestrador não sai do estado de intenção pendente e o bot continua perguntando "Olá! Como posso te ajudar?"

## Regra de negócio que deve continuar preservada

A correção solicitada NÃO deve mexer em:

- ConversationFlowOrchestrator
- Trinks
- WhatsApp
- executores
- disponibilidade

A correção deve ser mínima e focada no interpretador determinístico, ou, se a intenção já vier correta, no MessageContextUpdater.

## Estado atual do projeto

O estado do projeto até o ponto em questão é:

- o primeiro `oi` funciona corretamente
- mensagens com intenção clara de agendamento não avançam corretamente
- o ponto crítico está no reconhecimento do padrão determinístico para agendamento
- não há necessidade de IA nem refatoração arquitetural para resolver o problema

## Observações finais

A correção necessária é localizada e determinística:

- expandir o reconhecimento de padrões de agendamento
- garantir que frases como "fazer um agendamento" e "quero marcar um horário" gerem `ConversationIntent.BOOKING`
- manter o fluxo sem alterar o orquestrador e demais módulos

## Resumo em uma frase

O bug principal é que o sistema não está convertendo frases de agendamento em `BOOKING` no interpretador, então o contexto nunca muda e o fluxo conversacional continua preso em `AWAITING_INTENTION`.
