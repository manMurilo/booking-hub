# 🏗️ Arquitetura - Booking Hub WhatsApp

## Visão Geral

Sistema de agendamentos via WhatsApp usando IA (Grok) como orquestrador de conversas.

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp (Meta)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│           WhatsAppController (webhook receiver)              │
│                 POST /api/whatsapp/webhook                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│         WhatsAppService (orquestração principal)            │
│  - Normaliza telefone                                       │
│  - Gerencia conversa                                        │
│  - Processa com IA                                          │
│  - Determina próximo stage                                  │
└─────────────────────────────────────────────────────────────┘
        ↙               ↓                ↘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Conversation │ │  AI Service  │ │  Booking     │
│ StateService │ │  (Grok API)  │ │  Service     │
│              │ │              │ │              │
│ - Estados    │ │ - Processa   │ │ - Queries    │
│ - Histórico  │ │   mensagens  │ │ - Validação  │
│ - Metadata   │ │ - Prompts    │ │ - Clientes   │
└──────────────┘ └──────────────┘ └──────────────┘
       ↓               ↓                ↓
┌─────────────────────────────────────────────────────────────┐
│              Integração Trinks API                          │
│  - Clientes, Planos, Serviços, Profissionais, Agenda       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Diretórios

```
src/
├── ai/                          # Integração com LLM (Grok)
│   ├── ai.module.ts            # Módulo NestJS
│   ├── ai.service.ts           # Service com chamadas à API Grok
│   ├── ai.types.ts             # Tipos (AIMessage, AIResponse, etc)
│   └── prompts/
│       └── system.prompt.txt    # Instruções para IA
│
├── modules/
│   ├── booking/                 # Queries de agendamento
│   │   ├── booking.controller.ts # 7 endpoints GET/POST
│   │   ├── booking.service.ts    # 7 métodos de busca/validação
│   │   ├── booking.types.ts      # Tipos de resposta
│   │   └── booking.module.ts     # Integração com TrinksModule
│   │
│   ├── whatsapp/                # Orquestração WhatsApp
│   │   ├── whatsapp.controller.ts # Webhook receiver
│   │   ├── whatsapp.service.ts    # Orquestra fluxo
│   │   ├── whatsapp.types.ts      # Tipos WhatsApp
│   │   └── whatsapp.module.ts     # Integra todos módulos
│   │
│   ├── conversation-state/      # Gerenciamento de estado
│   │   ├── conversation-state.service.ts # 14+ métodos
│   │   └── conversation-state.types.ts   # Tipos de estado
│   │
│   ├── validators/              # Validação de dados
│   │   ├── cpf.validator.ts
│   │   ├── phone.validator.ts
│   │   ├── name.validator.ts
│   │   └── validators.module.ts
│   │
│   └── health/                  # Health check
│
├── integrations/
│   └── trinks/                  # API Trinks (pré-existente)
│       ├── clientes/
│       ├── agendamentos/
│       ├── planos/
│       ├── servicos/
│       └── profissionais/
│
├── common/
│   └── filters/
│       └── http-exception.filter.ts
│
└── app.module.ts               # Root module com todos imports
```

---

## 🔄 Fluxo de Mensagem

### 1. Recebimento
```
WhatsApp → POST /api/whatsapp/webhook
         → WhatsAppController.receiveMessage()
```

### 2. Normalização
```
phone: "11 98765-4321" → "5511987654321"
```

### 3. Recuperação de Conversa
```
ConversationStateService.getOrCreateConversation(phone)
  ↓
  Se não existe → cria nova
  Se existe → recupera histórico
```

### 4. Processamento com IA
```
AIService.processMessage(userMessage, conversationContext)
  ↓
  Monta histórico completo (últimas 50 mensagens)
  ↓
  Chama API Grok com system.prompt.txt
  ↓
  Retorna resposta gerada
```

### 5. Atualização de Estado
```
conversationState.currentStage:
  INITIAL → IDENTIFYING → IDENTIFIED → REGISTERING_NAME
  → REGISTRATION_COMPLETE → SCHEDULING_* → SCHEDULING_COMPLETE
```

### 6. Resposta
```
ProcessMessageResult {
  conversationId: "55119876543212026-08-14",
  aiResponse: "Resposta do Grok",
  action: "continue"|"escalate"|"complete",
  metadata: { stage, messageCount }
}
```

---

## 🧩 Componentes Chave

### AIService
- **Responsabilidade:** Processar mensagens com LLM
- **Dependências:** ConfigService
- **Métodos principais:**
  - `processMessage(userMessage, context)` → AIResponse
  - `callLLM(messages)` → string
  - `loadSystemPrompt()` → string
  - `getSystemPrompt()` → string

### WhatsAppService
- **Responsabilidade:** Orquestração do fluxo conversacional
- **Dependências:** AIService, BookingService, ConversationStateService
- **Métodos principais:**
  - `processMessage(whatsAppMessage)` → ProcessMessageResult
  - `normalizePhone(phone)` → string
  - `determineNextAction(...)` → 'continue'|'escalate'|'complete'
  - `getNextStage(...)` → ConversationStage

### ConversationStateService
- **Responsabilidade:** Rastreamento de estado de cada conversa
- **Armazenamento:** Map em memória (pode migrar para DB)
- **Métodos principais:**
  - `getOrCreateConversation(phone)` → ConversationState
  - `updateStage(conversationId, stage)` → void
  - `addMessageToHistory(conversationId, role, content)` → void
  - `getSummary(conversationId)` → object
  - `markForHumanHandover(conversationId)` → void

### BookingService
- **Responsabilidade:** Queries à API Trinks
- **Dependências:** ClientesService, AgendamentosService, etc (do TrinksModule)
- **Métodos principais:**
  - `findClienteByPhoneNumber(phone)` → ClienteSearchResult
  - `findClienteByCpf(cpf)` → ClienteSearchResult
  - `listPlanos()` → ListPlanosResponse
  - `listServicos()` → ListServicosResponse
  - `getAvailabilityForDay(profissionalId, data)` → AvailabilityResponse
  - `validateAppointment(...)` → ValidateAppointmentResult

---

## 📊 Tipos de Dados Principais

### ConversationStage (enum)
```typescript
INITIAL, IDENTIFYING, IDENTIFIED,
REGISTERING_CPF, REGISTERING_NAME, REGISTRATION_COMPLETE,
SCHEDULING_SERVICE, SCHEDULING_PROFESSIONAL, SCHEDULING_DATE, 
SCHEDULING_TIME, SCHEDULING_CONFIRMATION, SCHEDULING_COMPLETE,
CANCELLING, CANCELLATION_COMPLETE,
RESCHEDULING, RESCHEDULING_COMPLETE,
VIEWING_PLANS, VIEWING_SUBSCRIPTIONS,
HANDOVER_TO_HUMAN, CONVERSATION_END
```

### ConversationState
```typescript
{
  conversationId: string;
  phoneNumber: string;
  currentStage: ConversationStage;
  client: ClientData;
  scheduling?: SchedulingData;
  messageHistory: MessageHistory[];
  requiresHumanHandover: boolean;
}
```

### AIMessage
```typescript
{
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

---

## 🔐 Fluxo de Validação

```
Mensagem chega
  ↓
✓ Telefone não vazio?
  ↓
✓ Mensagem não vazia?
  ↓
✓ API Key Grok configurada?
  ↓
✓ Conversa existe?
  ↓
✓ Histórico compatível?
  ↓
✓ Resposta IA válida?
  ↓
✓ Stage transition permitida?
  ↓
Resposta enviada
```

---

## 🚀 Roadmap Futuro

### Phase 4: NLU & Intent Extraction (TODO)
```
Usuario: "Gostaria de um corte quinta à noite"
         ↓
AIService com extração de entidades
         ↓
{
  intention: "schedule_appointment",
  entities: {
    service: "corte de cabelo",
    date: "2026-08-21",
    time: "19:00"
  },
  confidence: 0.95
}
```

### Phase 5: Booking Confirmation (TODO)
```
POST /api/booking/agendar
  ↓
Criar agendamento na Trinks
  ↓
Armazenar confirmação na conversa
  ↓
Enviar confirmação ao cliente
```

### Phase 6: Advanced Features (TODO)
- Cancelamento e reagendamento via WhatsApp
- Notificações automáticas (lembretes 24h antes)
- Sistema de feedback e avaliação pós-serviço
- Sugestão de serviços baseado em histórico

### Phase 7: Persistência (TODO)
- Migrar ConversationStateService para PostgreSQL/MongoDB
- Arquivamento de conversas
- Analytics e relatórios
- Machine learning baseado em dados históricos

---

## 🔗 Dependências

```
NestJS 11.0.1
├── @nestjs/common
├── @nestjs/core
├── @nestjs/config
└── @nestjs/platform-express

TypeScript 5.7.3

Trinks API (HTTP fetch, sem SDK)

Grok API (OpenAI-compatible)
```

---

## 🎯 Objetivo Final

Sistema completamente autônomo de agendamentos via WhatsApp:

1. Cliente escreve no WhatsApp
2. IA compreende intenção
3. Sistema valida dados
4. Apresenta opções
5. Confirma agendamento
6. Salva na Trinks
7. Envia confirmação
8. Se complexo → escala para humano

---

**Status:** ✅ Arquitetura implementada e compilada
**Próximo:** Testes e refinamento de prompts
