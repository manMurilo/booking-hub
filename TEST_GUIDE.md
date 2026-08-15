# Script de Testes - Booking Hub

## 🧪 Teste 1: Health Check

```bash
curl -X GET http://localhost:3000/health
```

**Esperado:**
```json
{
  "status": "ok"
}
```

---

## 🧪 Teste 2: WhatsApp Health

```bash
curl -X GET http://localhost:3000/api/whatsapp/health
```

---

## 🧪 Teste 3: Listar Planos (API Trinks)

```bash
curl -X GET http://localhost:3000/api/booking/planos
```

---

## 🧪 Teste 4: Fluxo Completo WhatsApp com IA

### Passo 1: Cliente inicia conversa

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Olá, tudo bem?"
  }'
```

**Esperado:**
- Conversão de telefone: 11987654321 → 5511987654321
- Criação de nova conversa
- IA responde com saudação e pede identificação
- Stage: INITIAL → IDENTIFYING

### Passo 2: Cliente fornece CPF e nome

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Meu CPF é 12345678900 e meu nome é João Silva"
  }'
```

**Esperado:**
- CPF validado (11 dígitos)
- Nome normalizado (capitalizado)
- IA pergunta qual serviço deseja agendar
- Stage: IDENTIFIED → REGISTERING_NAME → REGISTRATION_COMPLETE

### Passo 3: Cliente escolhe serviço

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Gostaria de agendar um corte de cabelo"
  }'
```

**Esperado:**
- IA reconhece intenção: "schedule_appointment"
- Lista profissionais disponíveis
- Stage: SCHEDULING_SERVICE

### Passo 4: Cliente escolhe profissional

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Prefiro com a Maria"
  }'
```

**Esperado:**
- IA busca profissional "Maria"
- Se encontrado: pergunta data
- Stage: SCHEDULING_PROFESSIONAL

### Passo 5: Cliente escolhe data

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Quinta-feira da próxima semana"
  }'
```

---

## 🧪 Teste 5: Listar Serviços

```bash
curl -X GET http://localhost:3000/api/booking/servicos
```

---

## 🧪 Teste 6: Listar Profissionais

```bash
curl -X GET http://localhost:3000/api/booking/profissionais
```

---

## 🧪 Teste 7: Buscar Cliente por CPF

```bash
curl -X GET "http://localhost:3000/api/booking/cliente/by-cpf?cpf=12345678900"
```

---

## 🧪 Teste 8: Buscar Cliente por Telefone

```bash
curl -X GET "http://localhost:3000/api/booking/cliente/by-phone?phone=11987654321"
```

---

## 🧪 Teste 9: Disponibilidade de um Dia

```bash
curl -X GET "http://localhost:3000/api/booking/agenda/disponivel?profissionalId=1&data=2026-08-20"
```

---

## 🧪 Teste 10: Disponibilidade Múltiplos Dias

```bash
curl -X GET "http://localhost:3000/api/booking/agenda/disponivel/multiplos?profissionalId=1&servicoId=1&dataInicio=2026-08-20"
```

---

## 🧪 Teste 11: Validar Agendamento

```bash
curl -X POST http://localhost:3000/api/booking/validar-agendamento \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 123,
    "servicoId": 1,
    "profissionalId": 1,
    "dataHora": "2026-08-20 10:00"
  }'
```

**Esperado:**
```json
{
  "valid": true,
  "clienteId": 123,
  "servicoId": 1,
  "profissionalId": 1,
  "dataHora": "2026-08-20 10:00"
}
```

ou

```json
{
  "valid": false,
  "reason": "Horário não está disponível",
  "conflitos": ["Cliente já tem agendamento em 2026-08-20 14:00"]
}
```

---

## 🧪 Teste 12: Escalação para Atendente

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Preciso falar com um atendente humano, por favor"
  }'
```

**Esperado:**
- Detecção de palavra-chave: "atendente"
- action: "escalate"
- Stage: HANDOVER_TO_HUMAN
- requiresHumanHandover: true

---

## 🧪 Teste 13: Encerrar Conversa

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "text": "Obrigado, encerrar"
  }'
```

**Esperado:**
- action: "complete"
- Stage: CONVERSATION_END

---

## 🧪 Teste 14: Obter Resumo da Conversa

```bash
# Obter conversationId do teste anterior
curl -X GET "http://localhost:3000/api/whatsapp/conversation/55119876543212026-08-14"
```

**Esperado:**
```json
{
  "conversationId": "55119876543212026-08-14",
  "phoneNumber": "5511987654321",
  "createdAt": "2026-08-14T10:30:00.000Z",
  "lastMessageAt": "2026-08-14T10:45:30.000Z",
  "currentStage": "conversation_end",
  "messageCount": 8,
  "oopsCount": 0,
  "requiresHumanHandover": false
}
```

---

## 📊 Testando com Postman

### 1. Criar nova request
- Method: POST
- URL: `http://localhost:3000/api/whatsapp/test-message`
- Body (raw, JSON):
```json
{
  "phone": "11987654321",
  "text": "Olá"
}
```

### 2. Criar ambiente (opcional)
```
{
  "base_url": "http://localhost:3000",
  "conversation_id": "55119876543212026-08-14"
}
```

### 3. Tests automatizados
Adicionar a cada request:
```javascript
pm.test("Response status is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Response has conversationId", function() {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('conversationId');
    
    // Salvar para próximo teste
    pm.environment.set("conversation_id", jsonData.conversationId);
});

pm.test("AI response is not empty", function() {
    var jsonData = pm.response.json();
    pm.expect(jsonData.aiResponse.length).to.be.greaterThan(0);
});
```

---

## 🐛 Troubleshooting

### Erro: "AI Service not configured"
```bash
# Verificar se GROK_API_KEY está no .env
cat .env | grep GROK_API_KEY

# Se vazio, adicionar:
echo "GROK_API_KEY=xai-xxxx..." >> .env
```

### Erro: "Invalid phone format"
```bash
# Usar um destes formatos:
11987654321          # Sem país
5511987654321        # Com país (55)

# ✓ Aceitos
curl -d '{"phone":"11987654321"}'
curl -d '{"phone":"5511987654321"}'

# ✗ Rejeitados
curl -d '{"phone":"(11) 98765-4321"}'
curl -d '{"phone":"+55 11 98765-4321"}'
```

### Erro: "Cliente não encontrado"
```bash
# Verificar se a API Trinks está respondendo
curl http://localhost:3000/api/booking/clientes

# Se não houver dados, importar clientes de teste
# (Ver documentação Trinks)
```

---

## 📈 Métrica de Sucesso

Considere o fluxo completo testado quando:
- ✅ Telefone é normalizado corretamente
- ✅ Conversa é criada/recuperada
- ✅ IA responde com formação natural
- ✅ Histórico é mantido entre mensagens
- ✅ Stages avançam corretamente
- ✅ Escalação funciona
- ✅ Resumo da conversa é preciso
