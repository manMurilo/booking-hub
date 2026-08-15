# Guia Prático de Uso - Integração Baileys WhatsApp

## Iniciando a Aplicação

```bash
# Modo desenvolvimento (watch mode)
npm run start:dev

# Modo produção
npm run build
npm run start:prod
```

## Primeira Autenticação

1. **Iniciar a aplicação**
   ```bash
   npm run start:dev
   ```

2. **Buscar o QR Code no terminal**
   - Procure por:
   ```
   ╔════════════════════════════════════════╗
   ║   ESCANEIE COM O WHATSAPP             ║
   ║   QR Code válido por 30 segundos      ║
   ╚════════════════════════════════════════╝
   
   [código ASCII QR]
   ```

3. **Escanear com WhatsApp**
   - Abrir WhatsApp no celular
   - Ir para: Configurações → Vinculado → Vincular um dispositivo
   - Escanear o QR Code exibido no terminal

4. **Confirmar conexão**
   - Logs mostrarão:
   ```
   [WhatsApp] Conectado com sucesso
   [WhatsApp Service] Estado de conexão: connected - Conectado
   ```

## Reutilizando Sessão (Próximas Inicializações)

Não será necessário novo QR Code enquanto a sessão for válida.

**Se não aparecer QR Code:**
- ✅ Sessão foi reutilizada com sucesso
- Aplicação já está conectada ao WhatsApp

**Se aparecer novo QR Code:**
- ⚠️ Sessão expirou (provavelmente após 30 dias)
- Escanear novamente conforme seção anterior

## Enviando Mensagens de Teste

### Via API HTTP

```bash
curl -X POST http://localhost:3000/api/v1/whatsapp/test-message \
  -H "Content-Type: application/json" \
  -d '{"phone": "5511987654321", "text": "Teste de mensagem"}'
```

### Via Conversa Real

Envie uma mensagem do seu número pessoal para o número vinculado no WhatsApp Web. A aplicação:
1. Recebe a mensagem
2. Processa via AIService (Grok)
3. Gera resposta automática
4. Envia de volta via Baileys

## Entender Logs

```
[WhatsApp] Inicializando integração Baileys...
  → Baileys começando a conectar

[WhatsApp] Diretório de autenticação criado: .whatsapp-auth/
  → Primeira inicialização, criando pasta para sessão

[WhatsApp] QR Code disponível - escaneie com o WhatsApp
  → Precisa escanear QR Code

[WhatsApp] Conectado como Nome Do Usuario
  → Conectado com sucesso

[WhatsApp] Mensagem recebida de 5511987654321: "Olá"
  → Mensagem chegou do usuário

[WhatsApp] Mensagem enviada para 5511987654321: "Olá! Como posso ajudar?"
  → Resposta foi enviada

[WhatsApp] Conexão perdida, tentando reconectar...
  → Conexão caiu temporariamente, reconectando

[WhatsApp] Sessão inválida
  → Novo QR Code necessário
```

## Arquitetura para Referência

### Fluxo de Entrada de Mensagem

```
WhatsApp (usuário)
    ↓
Baileys WebSocket
    ↓
BaileysConnectionService
    ↓ (normaliza)
WhatsAppMessageAdapterService
    ↓
WhatsAppService.handleIncomingMessageFromBaileys()
    ↓
ConversationStateService (obtém/cria conversa)
    ↓
AIService (Grok processa)
    ↓
WhatsAppService (prepara resposta)
    ↓
BaileysConnectionService.sendMessage()
    ↓
WhatsApp (usuário recebe)
```

### Estrutura de Arquivos

```
src/
├── integrations/whatsapp/              [Apenas Baileys - Infraestrutura]
│   ├── baileys-connection.service.ts    [Conexão Baileys]
│   ├── whatsapp-message-adapter.service.ts [Normalização]
│   ├── whatsapp-integration.types.ts    [Tipos abstratos]
│   └── whatsapp-integration.module.ts   [Módulo]
│
└── modules/whatsapp/                   [Lógica de Negócio]
    ├── whatsapp.service.ts              [Orquestração]
    ├── whatsapp.controller.ts           [HTTP endpoints]
    ├── whatsapp.module.ts               [Módulo]
    └── whatsapp.types.ts                [Tipos de API]
```

**Regra:** Nenhum código de `src/modules/` deve chamar APIs do Baileys diretamente. Tudo passa por `BaileysConnectionService`.

## Troubleshooting

### "QR Code expirou, escaneie novamente"
**Solução:** O QR Code tem validade de ~30 segundos. Tente escanear mais rápido ou reinicie a aplicação.

### "Conexão recusada ao Baileys"
**Solução:** 
- Verifique se porta 3000 está livre
- Tente conectar em rede diferente (4G/WiFi)
- Reinicie o WhatsApp no celular

### "Ainda pede QR Code em segunda execução"
**Solução:**
- Verifique se `.whatsapp-auth/` existe e tem arquivos
- Se não existir ou estiver vazio, sessão não foi salva
- Certifique-se de que tem permissão de escrita no diretório

### "Aplicação recebe mensagem mas não responde"
**Verificar:**
1. Logs mostram `[WhatsApp Service] [WhatsApp Service] Estado de conexão: connected`?
   - Se não, Baileys não está conectado
2. `GROK_API_KEY` está configurada em `.env`?
   - Se não, AIService não pode gerar respostas
3. Arquivo `src/ai/prompts/system.prompt.txt` existe?
   - Se não, IA usar prompt padrão

### "Muitos logs do Baileys poluindo output"
**Solução:** Logger do Baileys está setado para `silent`. Se quiser ver internals, editar:
```typescript
// baileys-connection.service.ts, no createBaileysLogger():
level: 'trace', // mudou de 'silent'
```

## Desenvolvimento Futuro

### Adicionar Novo Tipo de Mensagem

```typescript
// Em baileys-connection.service.ts, handleMessagesUpsert():

// Adicionar após filtro de grupos:
if (message.message?.imageMessage) {
  // Processar imagem
  const imageBuffer = await this.sock.downloadMediaMessage(message);
}
```

### Implementar NLU para Agendamento

```typescript
// Em whatsapp.service.ts, processMessage():

const intention = await this.extractIntention(message.text);
if (intention === 'SCHEDULE') {
  // Chamar BookingService
  await this.bookingService.validateAppointment(...);
}
```

### Migrar para Meta Cloud API

1. Criar `src/integrations/whatsapp/meta-cloud-connection.service.ts`
2. Implementar interface `IWhatsAppConnection`
3. Registrar em `WhatsAppModule`
4. **Resto da aplicação permanece igual**

## Segurança

⚠️ **Nunca versione:**
- `.whatsapp-auth/` (credenciais de sessão)
- `.env` com valores reais
- Tokens ou chaves da API

✅ **Use:**
- `.env.example` como template
- `.gitignore` já configurado para `.whatsapp-auth/`
- Variáveis de ambiente para valores sensíveis

## Performance

- Conexão Baileys usa WebSocket (realtime)
- Mensagens processadas sequencialmente
- ConversationState em memória (limite ~24h por usuário)
- AIService aguarda resposta do Grok (latência da xAI API)

**Em produção sem banco:**
- Limite prático: ~1000 conversas simultâneas
- Com mais volume, considerar:
  - Redis para estado compartilhado
  - Banco de dados para histórico
  - Filas para processamento assíncrono

## Contatos Úteis

- **Baileys GitHub:** https://github.com/WhiskeySockets/Baileys
- **Grok API:** https://console.x.ai/
- **NestJS Docs:** https://docs.nestjs.com/
- **Trinks API:** https://docs.trinks.com/

---

**Última atualização:** 14/08/2026
