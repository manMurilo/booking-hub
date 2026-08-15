# API Booking Hub - Documentação Completa

## 📋 Endpoints Disponíveis

### Health Check
```
GET /health
Resposta: { status: "ok", timestamp: "..." }
```

### WhatsApp - Webhook
```
GET /api/whatsapp/webhook
Parâmetros:
  - hub.mode=subscribe
  - hub.verify_token=<WHATSAPP_VERIFY_TOKEN>
  - hub.challenge=<challenge>

Resposta: <challenge> (string)
```

```
POST /api/whatsapp/webhook
Body:
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "...",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "messages": [
              {
                "from": "5511999999999",
                "id": "wamid.xxx",
                "timestamp": "1692374325",
                "type": "text",
                "text": { "body": "Olá, gostaria de agendar" }
              }
            ]
          }
        }
      ]
    }
  ]
}

Resposta:
{
  "status": "ok",
  "processedCount": 1,
  "results": [
    {
      "conversationId": "55119999999992026-08-14",
      "aiResponse": "Olá! Bem-vindo à Trinks. Como posso ajudá-lo?",
      "action": "continue",
      "metadata": { "stage": "initial", "messageCount": 2 }
    }
  ]
}
```

### WhatsApp - Health
```
GET /api/whatsapp/health
Resposta: { status: "ok", service: "whatsapp", timestamp: "..." }
```

### WhatsApp - Test Message
```
POST /api/whatsapp/test-message
Body:
{
  "phone": "11999999999",
  "text": "Olá, gostaria de agendar um corte de cabelo"
}

Resposta:
{
  "conversationId": "55119999999992026-08-14",
  "aiResponse": "Claro! Vou ajudar você a agendar. Poderia me informar seu CPF?",
  "action": "continue",
  "metadata": { "stage": "identifying", "messageCount": 2 }
}
```

### WhatsApp - Get Conversation Summary
```
GET /api/whatsapp/conversation/:conversationId
Parâmetro: conversationId=55119999999992026-08-14

Resposta:
{
  "conversationId": "55119999999992026-08-14",
  "phoneNumber": "5511999999999",
  "createdAt": "2026-08-14T10:30:00.000Z",
  "lastMessageAt": "2026-08-14T10:35:45.000Z",
  "currentStage": "identifying",
  "messageCount": 3,
  "oopsCount": 0,
  "requiresHumanHandover": false
}
```

---

## Booking Endpoints

### Buscar Cliente por Telefone
```
GET /api/booking/cliente/by-phone?phone=11999999999

Resposta:
{
  "encontrado": true,
  "cliente": {
    "id": 123,
    "nome": "João Silva",
    "telefone": "5511999999999",
    "cpf": "12345678901",
    "email": "joao@email.com"
  }
}
```

### Buscar Cliente por CPF
```
GET /api/booking/cliente/by-cpf?cpf=12345678901

Resposta:
{
  "encontrado": true,
  "cliente": { ... }
}
```

### Listar Planos
```
GET /api/booking/planos

Resposta:
{
  "planos": [
    {
      "id": 1,
      "nome": "Plano Básico",
      "descricao": "Acesso a serviços básicos",
      "valor": 99.90
    },
    {
      "id": 2,
      "nome": "Plano Premium",
      "descricao": "Acesso a todos os serviços",
      "valor": 199.90
    }
  ]
}
```

### Listar Serviços
```
GET /api/booking/servicos

Resposta:
{
  "servicos": [
    {
      "id": 1,
      "nome": "Corte de Cabelo",
      "descricao": "Corte clássico",
      "duracao": 30,
      "valor": 50.00
    }
  ]
}
```

### Listar Profissionais
```
GET /api/booking/profissionais

Resposta:
{
  "profissionais": [
    {
      "id": 1,
      "nome": "Maria Santos",
      "especialidade": "Cabeleireira",
      "experiencia": 5
    }
  ]
}
```

### Obter Disponibilidade de um Dia
```
GET /api/booking/agenda/disponivel?profissionalId=1&data=2026-08-20

Resposta:
{
  "profissionalId": 1,
  "data": "2026-08-20",
  "slots": [
    { "horario": "09:00", "disponivel": true },
    { "horario": "09:30", "disponivel": true },
    { "horario": "10:00", "disponivel": false },
    { "horario": "10:30", "disponivel": true }
  ]
}
```

### Obter Disponibilidade Múltiplos Dias
```
GET /api/booking/agenda/disponivel/multiplos?profissionalId=1&servicoId=1&dataInicio=2026-08-20

Resposta:
{
  "profissionalId": 1,
  "servicoId": 1,
  "dias": [
    {
      "data": "2026-08-20",
      "slots": [ { "horario": "09:00", "disponivel": true } ]
    },
    {
      "data": "2026-08-21",
      "slots": [ ... ]
    }
  ]
}
```

### Validar Agendamento
```
POST /api/booking/validar-agendamento
Body:
{
  "clienteId": 123,
  "servicoId": 1,
  "profissionalId": 1,
  "dataHora": "2026-08-20 10:00"
}

Resposta (Válido):
{
  "valid": true,
  "clienteId": 123,
  "servicoId": 1,
  "profissionalId": 1,
  "dataHora": "2026-08-20 10:00"
}

Resposta (Inválido):
{
  "valid": false,
  "reason": "Horário não está disponível",
  "conflitos": ["Cliente já tem agendamento em 2026-08-20 14:00"]
}
```

---

## 🧪 Como Testar

### 1. Testar com Postman

**Importar Collection:**
```json
{
  "info": { "name": "Booking Hub API" },
  "item": [
    {
      "name": "WhatsApp - Test Message",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/api/whatsapp/test-message",
        "body": {
          "mode": "raw",
          "raw": "{\"phone\": \"11999999999\", \"text\": \"Olá, gostaria de agendar um corte\"}"
        }
      }
    },
    {
      "name": "Booking - Listar Planos",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/api/booking/planos"
      }
    }
  ]
}
```

### 2. Testar com cURL

```bash
# Test WhatsApp message
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{"phone":"11999999999","text":"Olá, gostaria de agendar"}'

# List plans
curl http://localhost:3000/api/booking/planos

# Search client by phone
curl "http://localhost:3000/api/booking/cliente/by-phone?phone=11999999999"

# Get daily availability
curl "http://localhost:3000/api/booking/agenda/disponivel?profissionalId=1&data=2026-08-20"

# Validate appointment
curl -X POST http://localhost:3000/api/booking/validar-agendamento \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 123,
    "servicoId": 1,
    "profissionalId": 1,
    "dataHora": "2026-08-20 10:00"
  }'
```

### 3. Testar Fluxo Conversacional Completo

```bash
# Mensagem 1: Cliente chega
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -d '{"phone":"11999999999","text":"Olá"}'
# Resposta: IA cumprimenta e pede identificação

# Mensagem 2: Cliente fornece CPF
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -d '{"phone":"11999999999","text":"Meu CPF é 12345678901"}'
# Resposta: IA busca/registra cliente e pergunta intenção

# Mensagem 3: Cliente quer agendar
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -d '{"phone":"11999999999","text":"Quero agendar um corte"}'
# Resposta: IA lista serviços e profissionais

# Verificar estado da conversa
curl "http://localhost:3000/api/whatsapp/conversation/55119999999992026-08-14"
```

---

## 🔐 Variáveis de Ambiente

Adicionar ao `.env`:

```env
# Grok API
GROK_API_KEY=xai-xxxxxxxxxxxx
GROK_MODEL=grok-2-1212
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7

# WhatsApp Webhook
WHATSAPP_VERIFY_TOKEN=seu_token_seguro_aqui
WHATSAPP_BUSINESS_ACCOUNT_ID=seu_id_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_numero_id_aqui
WHATSAPP_ACCESS_TOKEN=seu_token_aqui

# Trinks API
TRINKS_API_URL=https://api.trinks.com/v1
TRINKS_API_KEY=sua_chave_aqui

# Application
PORT=3000
NODE_ENV=development
```

---

## 📊 Próximas Fases

### Phase 4: NLU & Intent Extraction
- Detectar intenções do usuário com IA
- Extrair entidades (CPF, data, serviço, profissional)
- Melhorar precisão do fluxo conversacional

### Phase 5: Booking Confirmation
- Criar endpoint para confirmar agendamento
- Enviar confirmação ao cliente
- Integrar com calendário Trinks

### Phase 6: Advanced Features
- Suporte a cancelamento/reagendamento
- Sistema de feedback e avaliação
- Notificações automáticas (lembretes)
- Integração com pagamento

---

## 🐛 Troubleshooting

**Erro: "AI Service not configured"**
- Verificar se `GROK_API_KEY` está configurado no .env

**Erro: "Invalid verify token"**
- Verificar se `WHATSAPP_VERIFY_TOKEN` no código está igual ao do .env

**Erro: "Cliente não encontrado"**
- Testar com CPF que exista na API Trinks

**Erro: "Horário não disponível"**
- Verificar se a data está no futuro e se o profissional tem agenda disponível

---

## 📞 Support

Para mais informações sobre a API Trinks, consulte: https://docs.trinks.com
