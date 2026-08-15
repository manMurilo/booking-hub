# Contexto geral da aplicação

**Atualizado em:** 14/08/2026
**Branch de referência:** `main`

## 1. Objetivo atual

O Booking Hub é um backend intermediário entre o produto e plataformas externas de agendamento, com a Trinks como primeira integração.

O objetivo do MVP é construir primeiro uma base funcional e verificável para:

```text
Cliente / canal de comunicação
        ↓
Booking Hub
        ↓
Camada Booking
        ↓
Integração Trinks
```

A integração com WhatsApp e IA já possui uma implementação inicial, mas ainda não representa o fluxo completo de negócio do produto.

## 2. Decisões atuais do MVP

O projeto foi simplificado para evitar infraestrutura prematura.

Não existe atualmente:

- banco de dados;
- Prisma;
- persistência externa de conversas;
- filas;
- eventos;
- microsserviços;
- rate limiter complexo;
- retry automático para a Trinks;
- autenticação própria de usuários/clientes;
- infraestrutura de testes automatizados.

O estado de conversas utilizado pelo protótipo fica em memória.

A regra é simples:

> Adicionar infraestrutura somente quando uma necessidade concreta do produto exigir.

## 3. Stack

- NestJS 11
- TypeScript 5.7
- Node.js
- REST API
- `fetch` nativo para chamadas HTTP externas
- `@nestjs/config`
- Swagger / OpenAPI
- `class-validator`
- `class-transformer`

## 4. Estrutura atual

```text
src/
├── ai/
│   ├── ai.module.ts
│   ├── ai.service.ts
│   ├── ai.types.ts
│   └── prompts/
│       └── system.prompt.txt
│
├── common/
│   └── filters/
│       └── http-exception.filter.ts
│
├── integrations/
│   └── trinks/
│       ├── agendamentos/
│       ├── assinaturas/
│       ├── clientes/
│       ├── planos/
│       ├── profissionais/
│       ├── servicos/
│       ├── trinks.module.ts
│       └── trinks.service.ts
│
└── modules/
    ├── booking/
    ├── conversation-state/
    ├── health/
    ├── validators/
    └── whatsapp/
```

A integração Trinks é organizada por domínio para manter controllers, services e types próximos da funcionalidade correspondente.

## 5. Bootstrap da aplicação

`src/main.ts` configura:

- prefixo global `/api/v1`;
- CORS;
- `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`;
- `HttpExceptionFilter` global;
- Swagger em `/docs`;
- porta definida por `PORT`, com padrão `3000`.

## 6. Integração Trinks

A integração é HTTP direta, sem SDK oficial.

Headers utilizados:

```http
X-Api-Key: <TRINKS_API_KEY>
estabelecimentoId: <TRINKS_ESTABELECIMENTO_ID>
```

Configuração:

```env
TRINKS_API_KEY=...
TRINKS_BASE_URL=...
TRINKS_ESTABELECIMENTO_ID=232903
```

O estabelecimento usado no MVP é:

```text
232903 — Crazy Dog Barber
```

O `estabelecimentoId` é configuração da integração e não deve ser recebido do usuário.

A API Key real nunca deve ser versionada.

### Domínios presentes no código

- Agendamentos
- Clientes
- Assinaturas
- Planos
- Profissionais
- Serviços

### Limites conhecidos

- 60 requisições/minuto
- 5.000 requisições/mês
- `429 Too Many Requests` quando excedido

O projeto não implementa retry automático nem rate limiter complexo neste momento.

## 7. Agendamentos

O recurso de agendamentos já possui integração para:

- consulta de agendamentos;
- consulta de agenda de profissionais;
- consulta de disponibilidade;
- criação de agendamento;
- edição de agendamento;
- cancelamento;
- preparação do payload de criação.

A criação/edição/cancelamento são chamadas de integração e ainda não formam um fluxo completo de negócio do Booking Hub.

A consulta de agendamentos aceita paginação, cliente e período (`dataInicio`/`dataFim`). O Booking Hub não percorre automaticamente todas as páginas.

Foi validada a normalização de datas brasileiras para o formato esperado pela Trinks.

Exemplo validado:

```text
12/08/2026
→
dataInicio=2026-08-12T00:00:00
dataFim=2026-08-12T23:59:59
```

A documentação específica está em [`trinks-agendamentos.md`](./trinks-agendamentos.md).

## 8. Clientes

A integração de clientes está implementada com:

```http
GET  /api/v1/trinks/clientes
GET  /api/v1/trinks/clientes/:id
POST /api/v1/trinks/clientes
```

O recurso suporta filtros como nome, CPF, e-mail, telefone, datas de cadastro/alteração, paginação e `incluirDetalhes`.

A camada `BookingService` utiliza essa integração para buscar clientes por telefone e CPF.

## 9. Demais recursos Trinks

Também existem integrações para:

```http
GET /api/v1/trinks/assinaturas
GET /api/v1/trinks/planos
GET /api/v1/trinks/profissionais
GET /api/v1/trinks/profissionais/:profissionalId/servicos
GET /api/v1/trinks/profissionais/categoria/:servicoCategoriaEstabelecimentoId
GET /api/v1/trinks/servicos
```

Esses recursos estão na camada de integração e devem ser tratados como operações sobre a API externa, não como domínio completo do Booking Hub.

## 10. Camada Booking

`src/modules/booking` funciona como uma camada intermediária orientada às necessidades do produto.

Atualmente possui operações para:

- buscar cliente por telefone;
- buscar cliente por CPF;
- consultar disponibilidade de um profissional em uma data;
- consultar disponibilidade em uma operação chamada de múltiplos dias;
- listar planos;
- listar serviços;
- listar profissionais;
- validar agendamento.

### Limitação importante

A operação `getAvailabilityMultipleDays` existente no código atualmente consulta apenas `dataInicio` e retorna um único dia. O parâmetro `dataFim` é recebido pelo controller, mas não resulta em uma varredura real do intervalo.

Não documentar essa operação como busca completa de vários dias até que isso seja implementado.

## 11. Validadores

O módulo `validators` contém validadores específicos para:

- CPF;
- telefone;
- nome.

Eles são utilizados pela camada Booking e servem para normalizar/validar dados antes das consultas à Trinks.

## 12. Estado conversacional

`ConversationStateService` mantém o estado das conversas em memória.

O estado inclui, entre outros:

- identificador da conversa;
- telefone normalizado;
- stage atual;
- intenção anterior;
- dados do cliente;
- dados de agendamento;
- histórico de mensagens;
- necessidade de atendimento humano.

Não existe persistência em banco nesta fase.

## 13. IA

`AIService` integra com a API da xAI usando formato compatível com OpenAI.

Configurações principais:

```env
GROK_API_KEY=...
GROK_MODEL=grok-2-1212
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7
```

O prompt é carregado de:

```text
src/ai/prompts/system.prompt.txt
```

A IA já consegue receber histórico e produzir uma resposta textual.

### Limitação atual

A extração estruturada de intenção e entidades ainda não está implementada como fluxo efetivo. O código possui tipos para intenção/entidades, mas o `WhatsAppService` ainda depende principalmente de regras simples para decidir `continue`, `escalate` ou `complete`.

## 14. WhatsApp

O `WhatsAppController` possui endpoints de webhook, health, teste de mensagem e consulta de conversa.

O `WhatsAppService` atualmente:

1. normaliza o telefone;
2. cria/recupera a conversa;
3. salva a mensagem;
4. monta o contexto;
5. chama o `AIService`;
6. salva a resposta;
7. identifica escalação/encerramento por regras simples;
8. avança stages básicos.

### Limitações atuais

- não envia resposta para a API real do WhatsApp;
- não possui NLU estruturado completo;
- não executa automaticamente as ações de Booking a partir da intenção da IA;
- não conclui o fluxo real de agendamento/cancelamento/reagendamento.

## 15. Inconsistências conhecidas de rota

O `main.ts` aplica `/api/v1` globalmente, enquanto os controllers de Booking e WhatsApp foram declarados com `api/...` no decorator.

Por isso, atualmente essas rotas resultam em:

```text
/api/v1/api/booking/...
/api/v1/api/whatsapp/...
```

Isso é uma inconsistência de implementação e deve ser corrigido antes de considerar essas rotas estáveis.

Também existe um problema no endpoint de consulta de conversa: a rota declara `:conversationId`, mas o controller tenta obter o valor com `@Body()` em vez de `@Param()`.

## 16. Estado atual do MVP

### Funcional

- estrutura NestJS;
- integração Trinks por domínio;
- configuração por `.env`;
- consulta de agendamentos;
- consulta de agenda/disponibilidade;
- operações de clientes;
- operações de profissionais, serviços, planos e assinaturas;
- camada inicial Booking;
- validadores;
- estado conversacional em memória;
- integração inicial com Grok;
- webhook/controlador WhatsApp inicial;
- Swagger;
- tratamento global de validação e exceções.

### Ainda não concluído

- NLU estruturado confiável;
- fluxo completo de agendamento orientado pela conversa;
- cancelamento/reagendamento como fluxo de produto;
- envio efetivo de mensagens pela API do WhatsApp;
- persistência de conversas;
- regras de negócio completas desacopladas da Trinks.

## 17. Próximo foco

A prioridade é consolidar a camada de integração e Booking antes de avançar para automação conversacional completa.

A próxima funcionalidade deve ser pequena, verificável e baseada no comportamento real da Trinks.

> **Primeiro funcionalidade verificável; depois infraestrutura.**
