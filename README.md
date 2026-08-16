# Booking Hub

Backend em NestJS que centraliza a integração do produto com a API da Trinks e possui uma camada inicial para consultas de booking, estado conversacional e processamento de mensagens via WhatsApp com Grok.

> **Estado em 16/08/2026:** o MVP do fluxo principal de agendamento está implementado e validado em memória. A integração Trinks, a identificação/cadastro de cliente, a consulta de disponibilidade, a confirmação explícita e a criação de agendamento estão conectadas ao fluxo conversacional via WhatsApp/Baileys.

## Objetivo atual

Construir uma API intermediária que permita evoluir de chamadas diretas à Trinks para um fluxo conversacional via WhatsApp, sem introduzir banco de dados ou infraestrutura complexa antes de existir necessidade real.

Fluxo alvo:

```text
WhatsApp
   ↓
Booking Hub
   ↓
Booking / regras de negócio
   ↓
Integração Trinks
   ↓
Resposta
   ↓
WhatsApp
```

## Stack

- NestJS 11
- TypeScript 5.7
- Node.js
- REST API
- `fetch` nativo para HTTP
- `@nestjs/config`
- Swagger / OpenAPI
- `class-validator` + `class-transformer`
- Grok via API compatível com OpenAI (integração presente, ainda não é requisito do núcleo Trinks)

## Arquitetura atual

```text
src/
├── ai/                         # Integração com Grok
├── common/filters/             # Tratamento global de exceções
├── integrations/trinks/        # Integração externa com a Trinks
│   ├── agendamentos/
│   ├── assinaturas/
│   ├── clientes/
│   ├── planos/
│   ├── profissionais/
│   └── servicos/
└── modules/
    ├── booking/                # Fachada para consultas orientadas ao produto
    ├── conversation-state/     # Estado de conversa em memória
    ├── health/                 # Health check
    ├── validators/             # CPF, telefone e nome
    └── whatsapp/               # Webhook e orquestração conversacional
```

A integração Trinks é organizada por domínio, evitando concentrar todos os recursos em um único service/controller.

## Trinks

A integração usa:

```http
X-Api-Key: <TRINKS_API_KEY>
estabelecimentoId: <TRINKS_ESTABELECIMENTO_ID>
```

Configuração principal:

```env
TRINKS_API_KEY=...
TRINKS_BASE_URL=...
TRINKS_ESTABELECIMENTO_ID=...
```

A API Key nunca deve ser versionada.

Domínios atualmente integrados:

- agendamentos
- clientes
- assinaturas
- planos
- profissionais
- serviços

A paginação é repassada/consultada conforme o recurso; o Booking Hub não faz varredura automática de todas as páginas.

Limites conhecidos da API Trinks:

- 60 requisições/minuto
- 5.000 requisições/mês
- HTTP 429 quando o limite é excedido

Não há retry automático ou rate limiter complexo neste momento.

## Camada Booking

`BookingService` funciona como uma fachada de consultas para o restante da aplicação. Atualmente possui operações para:

- buscar cliente por telefone;
- buscar cliente por CPF;
- consultar disponibilidade de um profissional em um dia;
- consultar disponibilidade em uma operação de múltiplos dias;
- listar planos;
- listar serviços;
- listar profissionais;
- validar um agendamento.

Essa camada ainda não representa um domínio completo de agendamento.

## IA e WhatsApp

O `AIService` chama a API da xAI usando Grok/OpenAI-compatible API e carrega o prompt de `src/ai/prompts/system.prompt.txt`.

O `ConversationStateService` mantém conversas em memória, incluindo histórico limitado, stage, intenção e dados coletados.

O `WhatsAppService` atualmente:

1. normaliza o telefone;
2. cria/recupera a conversa em memória;
3. agrupa mensagens curtas por debounce;
4. interpreta intenção e entidades com fallback determinístico;
5. identifica cliente por telefone ou CPF;
6. cadastra cliente novo com nome, CPF e telefone;
7. resolve serviço/profissional contra a Trinks;
8. consulta disponibilidade real;
9. solicita confirmação explícita;
10. cria o agendamento somente após a confirmação;
11. envia respostas pelo Baileys quando conectado.

O fluxo conversacional principal de agendamento está concluído. Cancelamento, reagendamento e persistência externa continuam como escopo pós-MVP, pois exigem regras e telas/integrações adicionais que não são necessárias para validar a hipótese central do produto.

## Rotas

O prefixo global configurado em `main.ts` é:

```text
/api/v1
```

### Health

```http
GET /api/v1/health
```

### Trinks

```http
GET    /api/v1/trinks/agendamentos
GET    /api/v1/trinks/agenda
GET    /api/v1/trinks/agendamentos/profissionais
GET    /api/v1/trinks/disponibilidade
POST   /api/v1/trinks/agendamentos
PUT    /api/v1/trinks/agendamentos/:id
PATCH  /api/v1/trinks/agendamentos/:agendamentoId/status/cancelado
POST   /api/v1/trinks/agendamentos/prepare

GET    /api/v1/trinks/clientes
GET    /api/v1/trinks/clientes/:id
POST   /api/v1/trinks/clientes

GET    /api/v1/trinks/assinaturas
GET    /api/v1/trinks/planos
GET    /api/v1/trinks/profissionais
GET    /api/v1/trinks/profissionais/:profissionalId/servicos
GET    /api/v1/trinks/profissionais/categoria/:servicoCategoriaEstabelecimentoId
GET    /api/v1/trinks/servicos
```

### Booking

O controller de Booking usa `@Controller('booking')` e a aplicação aplica o prefixo global `/api/v1`. As rotas públicas são:

```http
POST /api/v1/booking/agendamento
GET  /api/v1/booking/cliente/by-phone
GET  /api/v1/booking/cliente/by-cpf
GET  /api/v1/booking/agenda/disponivel
GET  /api/v1/booking/agenda/disponivel/multiplos
GET  /api/v1/booking/planos
GET  /api/v1/booking/servicos
GET  /api/v1/booking/profissionais
POST /api/v1/booking/validar-agendamento
```

A duplicação `api/v1/api` foi removida; novas integrações devem usar as rotas acima.

### WhatsApp

As rotas públicas do controller WhatsApp são:

```http
POST /api/v1/whatsapp/webhook
GET  /api/v1/whatsapp/webhook
GET  /api/v1/whatsapp/health
POST /api/v1/whatsapp/test-message
GET  /api/v1/whatsapp/conversation/:conversationId
```

O endpoint de conversa lê o identificador pela rota com `@Param('conversationId')`.

## Execução local

```bash
npm install
npm run start:dev
```

Servidor padrão:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/docs
```

Build:

```bash
npm run build
```

## Variáveis de ambiente

```env
PORT=3000
NODE_ENV=development

TRINKS_BASE_URL=...
TRINKS_API_KEY=...
TRINKS_ESTABELECIMENTO_ID=...

GROK_API_KEY=...
GROK_MODEL=grok-2-1212
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7

WHATSAPP_VERIFY_TOKEN=...
```

As variáveis específicas de WhatsApp/IA só são necessárias para os módulos correspondentes.

## Estado e próximos passos

O caminho principal do MVP está concluído: uma conversa pode identificar ou cadastrar o cliente, resolver o serviço, consultar a disponibilidade, solicitar confirmação e criar o agendamento na Trinks. O estado continua em memória por decisão explícita de escopo.

As próximas evoluções são cancelamento conversacional, reagendamento, persistência de conversas e observabilidade operacional. Elas não devem ser adicionadas antes de uma necessidade concreta do produto.

> **Funcionalidade verificável primeiro; infraestrutura somente quando necessária.**

Para o contexto detalhado, consulte [`docs/contexto-geral-da-aplicacao.md`](docs/contexto-geral-da-aplicacao.md).
Para detalhes da integração de agendamentos, consulte [`docs/trinks-agendamentos.md`](docs/trinks-agendamentos.md).
