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

A operação `getAvailabilityMultipleDays` percorre o intervalo inclusivo entre `dataInicio` e `dataFim`, consultando a agenda da Trinks para cada dia. O serviço mantém a validação de datas e rejeita intervalos invertidos.

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

A extração estruturada combina interpretação semântica opcional com fallback determinístico. O backend continua sendo responsável por validar entidades, resolver IDs na Trinks e controlar as transições de negócio.

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

### Estado atual

- recebe mensagens pelo adaptador Baileys e agrupa turnos com debounce;
- interpreta intenção, serviço, profissional, data, horário, CPF e confirmação;
- identifica cliente por telefone ou CPF;
- cadastra cliente novo com telefone, nome e CPF;
- consulta disponibilidade real na Trinks;
- cria agendamento somente após confirmação explícita;
- envia respostas via Baileys quando a conexão está disponível.

Cancelamento conversacional, reagendamento e persistência externa permanecem como escopo pós-MVP.

## 15. Rotas públicas

O `main.ts` aplica `/api/v1`; Booking e WhatsApp usam decorators relativos ao prefixo global. As rotas são expostas sem duplicação `api/v1/api`, e o endpoint de conversa usa `@Param('conversationId')`.

As rotas principais estão documentadas no `README.md` e no Swagger em `/docs`.

## 16. Estado atual do MVP

### Funcional

- estrutura NestJS;
- integração Trinks por domínio;
- configuração por `.env`;
- consulta de agendamentos;
- consulta de agenda/disponibilidade;
- operações de clientes;
- operações de profissionais, serviços, planos e assinaturas;
- camada Booking com resolução de referências e criação de agendamento;
- validadores;
- estado conversacional em memória;
- interpretação semântica opcional com fallback determinístico;
- identificação e cadastro de clientes;
- webhook/controlador WhatsApp com envio via Baileys;
- Swagger;
- tratamento global de validação e exceções.

### Pós-MVP

- cancelamento conversacional;
- reagendamento conversacional;
- persistência de conversas;
- regras de negócio adicionais desacopladas da Trinks;
- observabilidade e operação de atendimento humano.

## 17. Próximo foco

O fluxo principal de agendamento do MVP está concluído e coberto por testes unitários e por um teste de fluxo em memória. A próxima evolução recomendada é implementar cancelamento e reagendamento somente quando as regras operacionais estiverem definidas.

> **Primeiro funcionalidade verificável; depois infraestrutura.**
