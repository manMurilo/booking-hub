# 🚀 Guia de Início - Booking Hub

## ✅ Status Atual

- ✅ Fase 1: Validators + Conversation State Service
- ✅ Fase 2: Booking Module (queries e endpoints)
- ✅ Fase 3: AI Service (Grok) + WhatsApp Module
- ✅ Build compilando com sucesso

**Configuração necessária:** `GROK_API_KEY` no `.env`

---

## 📦 Instalação e Setup

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente

Criar arquivo `.env` na raiz:

```env
# Server
PORT=3000
NODE_ENV=development

# Grok/OpenAI API
GROK_API_KEY=xai-xxxxxxxxxxxxxxxxxxxx
GROK_MODEL=grok-2-1212
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7

# WhatsApp Webhook (opcional por enquanto)
WHATSAPP_VERIFY_TOKEN=token_super_secreto_123

# Trinks API
TRINKS_API_URL=https://api.trinks.com/v1
TRINKS_API_KEY=sua_chave_aqui
```

### 3. Build
```bash
npm run build
```

### 4. Iniciar servidor
```bash
npm run start
```

Servidor estará disponível em: `http://localhost:3000`

---

## 🧪 Testes Recomendados

### Teste 1: Health Check
```bash
curl http://localhost:3000/health
```

### Teste 2: Listar Planos (sem AI, só API Trinks)
```bash
curl http://localhost:3000/api/booking/planos
```

### Teste 3: Fluxo WhatsApp com IA

**Mensagem 1 - Cliente chega**
```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Olá, gostaria de agendar um horário"
  }'
```

**Esperado:**
```json
{
  "conversationId": "55119876543212026-08-14",
  "aiResponse": "Olá, bom dia! Bem-vindo à Trinks. Para ajudá-lo melhor, poderia me informar seu CPF?",
  "action": "continue",
  "metadata": { "stage": "initial" }
}
```

---

**Mensagem 2 - Cliente fornece informações**
```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Meu CPF é 12345678900 e meu nome é João Silva"
  }'
```

**Esperado:**
```json
{
  "conversationId": "55119876543212026-08-14",
  "aiResponse": "Perfeito, João! Agora que identifiquei você, qual serviço gostaria de agendar? Temos corte de cabelo, hidratação, coloração...",
  "action": "continue",
  "metadata": { "stage": "identifying", "messageCount": 3 }
}
```

---

**Mensagem 3 - Cliente escolhe serviço**
```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Gostaria de um corte de cabelo"
  }'
```

---

### Teste 4: Escalação

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Preciso falar com um atendente humano"
  }'
```

**Esperado:** `"action": "escalate"`

---

## 📊 Estrutura de Dados

### Conversation State
```typescript
{
  conversationId: string;              // ID único
  phoneNumber: string;                 // 55 + DDD + NNNNNNNNN
  currentStage: ConversationStage;     // INITIAL, IDENTIFYING, etc
  client: ClientData;                  // CPF, nome, ID na Trinks
  messageHistory: MessageHistory[];    // Últimas 50 mensagens
  requiresHumanHandover: boolean;      // Se precisa escalar
}
```

### Message History
```typescript
{
  role: 'client' | 'bot';
  content: string;
  timestamp: Date;
  stage: ConversationStage;
}
```

---

## 🔄 Fluxo Conversacional

```
INITIAL
  ↓ (AI pergunta identificação)
IDENTIFYING
  ↓ (Cliente fornece CPF)
IDENTIFIED
  ↓ (AI pede nome)
REGISTERING_NAME
  ↓ (Cliente informa nome)
REGISTRATION_COMPLETE
  ↓ (AI pergunta intenção: agendar/cancelar/etc)
SCHEDULING_SERVICE
  ↓ (Cliente escolhe serviço)
SCHEDULING_PROFESSIONAL
  ↓ (Cliente escolhe profissional)
SCHEDULING_DATE
  ↓ (Cliente escolhe data)
SCHEDULING_TIME
  ↓ (Cliente escolhe horário)
SCHEDULING_CONFIRMATION
  ↓ (Cliente confirma)
SCHEDULING_COMPLETE
```

---

## 🎯 Próximas Melhorias

### Phase 4: NLU Enhancement
- [ ] Detectar intenções com score de confiança
- [ ] Extrair entidades (datas, horários, nomes)
- [ ] Tratamento de typos e variações

### Phase 5: Booking Creation
- [ ] POST `/api/booking/agendar` - criar agendamento
- [ ] PUT `/api/booking/agendamento/:id` - reagendar
- [ ] DELETE `/api/booking/agendamento/:id` - cancelar

### Phase 6: Confirmação WhatsApp
- [ ] Enviar confirmação ao cliente via WhatsApp
- [ ] Notificações de lembrança
- [ ] Integração com calendário Trinks

### Phase 7: Persistência
- [ ] Migrar ConversationStateService para banco de dados
- [ ] Suportar histórico de conversas (analytics)
- [ ] Backup e recuperação

---

## 📝 Logs Úteis

Ativar logs detalhados:
```bash
npm run start:debug
```

Ver apenas WhatsApp messages:
```bash
npm run start 2>&1 | grep -i whatsapp
```

---

## ✨ Tips

1. **Testar AI sem servidor:** Use o script de teste em `src/ai/test.ts`
2. **Verificar estado da conversa:** GET `/api/whatsapp/conversation/{id}`
3. **Reset de conversa:** Usar novo número de telefone
4. **Modo debug:** Adicionar `logger.debug()` antes de compilar

---

## 🆘 Problemas Comuns

| Erro | Solução |
|------|---------|
| `GROK_API_KEY not found` | Adicionar ao `.env` e reiniciar servidor |
| `Invalid phone format` | Usar formato: 11987654321 ou 5511987654321 |
| `Cliente não encontrado` | Verificar CPF com Trinks API |
| `Horário indisponível` | Testar com datas futuras |

---

**Status: ✅ Pronto para testes!**
