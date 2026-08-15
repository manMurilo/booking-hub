# Booking Hub

Backend em NestJS que centraliza a integração do produto com a API da Trinks e já possui uma camada inicial para consultas de booking, estado conversacional e processamento de mensagens via WhatsApp com Grok.

> **Estado em 14/08/2026:** o projeto está em fase de fundação/MVP. A integração Trinks está avançada; os módulos de Booking, estado conversacional, IA e WhatsApp existem, mas o fluxo conversacional ainda é prototípico e não executa o ciclo completo de agendamento.

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
- Jest está disponível no projeto e há testes automatizados existentes
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
TRINKS_ESTABELECIMENTO_ID=232903
```

Estabelecimento utilizado no MVP:

```text
232903 — Crazy Dog Barber
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
- consultar disponibilidade em uma operação de múltiplos dias (implementação atual consulta apenas o dia inicial);
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
2. cria/recupera a conversa;
3. registra a mensagem;
4. envia o contexto ao Grok;
5. registra a resposta;
6. aplica regras simples para `continue`, `escalate` e `complete`;
7. avança alguns stages básicos.

**Importante:** a extração estruturada de intenção/entidades ainda não está implementada de forma efetiva e o `WhatsAppService` ainda não executa automaticamente as operações de Booking com base na resposta da IA. Portanto, o fluxo completo de agendar/cancelar/reagendar ainda não está pronto.

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

Os controllers atuais usam `@Controller('api/booking')` e a aplicação também possui prefixo global `/api/v1`. Portanto, as rotas efetivamente expostas pelo código são:

```http
GET  /api/v1/api/booking/cliente/by-phone
GET  /api/v1/api/booking/cliente/by-cpf
GET  /api/v1/api/booking/agenda/disponivel
GET  /api/v1/api/booking/agenda/disponivel/multiplos
GET  /api/v1/api/booking/planos
GET  /api/v1/api/booking/servicos
GET  /api/v1/api/booking/profissionais
POST /api/v1/api/booking/validar-agendamento
```

A duplicação `api/v1/api` é uma inconsistência atual de roteamento e deve ser corrigida antes de tratar essas rotas como API pública estável.

### WhatsApp

Pelo mesmo motivo, as rotas atuais do controller são efetivamente:

```http
POST /api/v1/api/whatsapp/webhook
GET  /api/v1/api/whatsapp/webhook
GET  /api/v1/api/whatsapp/health
POST /api/v1/api/whatsapp/test-message
GET  /api/v1/api/whatsapp/conversation/:conversationId
```

Há ainda uma inconsistência no endpoint de conversa: o controller declara `:conversationId`, mas lê o valor com `@Body()` em vez de `@Param()`. Isso precisa ser corrigido quando esse endpoint for validado.

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

Testes:

```bash
npm test
```

## Variáveis de ambiente

```env
PORT=3000
NODE_ENV=development

TRINKS_BASE_URL=...
TRINKS_API_KEY=...
TRINKS_ESTABELECIMENTO_ID=232903

GROK_API_KEY=...
GROK_MODEL=grok-2-1212
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7

WHATSAPP_VERIFY_TOKEN=...
```

As variáveis específicas de WhatsApp/IA só são necessárias para os módulos correspondentes.

## Próximo foco

O próximo passo deve ser **consolidar e validar a camada de Booking/Trinks**, especialmente clientes e operações de agendamento, antes de avançar o fluxo conversacional.

A prioridade continua sendo:

> **funcionalidade verificável primeiro; infraestrutura somente quando necessária.**

Para o contexto detalhado, consulte [`docs/contexto-geral-da-aplicacao.md`](docs/contexto-geral-da-aplicacao.md).
Para detalhes da integração de agendamentos, consulte [`docs/trinks-agendamentos.md`](docs/trinks-agendamentos.md).
Para a referência consolidada das rotas, consulte [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md).
