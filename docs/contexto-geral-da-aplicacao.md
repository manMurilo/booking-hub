# Contexto geral da aplicação

## Visão resumida

O Booking Hub atual é um backend em NestJS que funciona como uma camada de integração com a API da Trinks. O objetivo principal da aplicação, no momento, é expor endpoints locais que encapsulam operações de agendamentos, clientes, profissionais e serviços, sem depender de um banco de dados próprio.

A arquitetura está em estágio de MVP e privilegia simplicidade e integração com o provedor externo, em vez de uma modelagem de domínio completa.

## Stack atual

- NestJS
- TypeScript
- `@nestjs/config` para leitura de variáveis de ambiente
- `@nestjs/swagger` para geração de documentação OpenAPI
- `class-validator` e `class-transformer` para validação global
- Fetch nativo do runtime para comunicação com a API da Trinks

## Estrutura principal

- `src/main.ts` — bootstrap da aplicação
- `src/app.module.ts` — registro dos módulos globais
- `src/modules/health` — health check do backend
- `src/integrations/trinks` — módulo central de integração com a Trinks
- `src/common/filters/http-exception.filter.ts` — filtro global de exceções

## Módulos e responsabilidades

### `HealthModule`

Responsável por expor a rota de verificação de vida da aplicação.

Endpoint:

- `GET /api/v1/health`

Resposta esperada:

```json
{ "status": "ok" }
```

### `TrinksModule`

Módulo responsável por consolidar todas as integrações com a API Trinks. Ele reúne os controllers e serviços de:

- agendamentos
- clientes
- profissionais
- serviços

Todos os endpoints desse módulo são montados sob o prefixo `/api/v1/trinks`.

## Regras de integração

### Configuração

A classe `TrinksService` valida a presença das variáveis abaixo:

- `TRINKS_API_KEY`
- `TRINKS_BASE_URL`
- `TRINKS_ESTABELECIMENTO_ID`

Se qualquer uma estiver faltando, a aplicação responde com erro interno do servidor.

### Autenticação

A API da Trinks exige o header:

```http
X-Api-Key: <TRINKS_API_KEY>
```

Além disso, o header `estabelecimentoId` também é enviado para as requisições. Esse valor vem da variável de ambiente `TRINKS_ESTABELECIMENTO_ID` e não deve ser informado pelo cliente.

### Normalização de dados

O `TrinksService` também centraliza conversões úteis, como:

- conversão de datas no formato brasileiro (`dd/MM/yyyy`) para ISO
- ajuste do path da URL para o endpoint de profissionais por data
- montagem da URL final com o prefixo `/v1` quando necessário

## Endpoints expostos na API

### Saúde

- `GET /api/v1/health`

### Agendamentos

- `GET /api/v1/trinks/agendamentos`
- `GET /api/v1/trinks/agenda`
- `GET /api/v1/trinks/agendamentos/profissionais`
- `GET /api/v1/trinks/disponibilidade`
- `POST /api/v1/trinks/agendamentos`
- `PUT /api/v1/trinks/agendamentos/:id`
- `PATCH /api/v1/trinks/agendamentos/:agendamentoId/status/cancelado`

### Clientes

- `GET /api/v1/trinks/clientes`
- `GET /api/v1/trinks/clientes/:id`
- `POST /api/v1/trinks/clientes`

### Profissionais

- `GET /api/v1/trinks/profissionais`
- `GET /api/v1/trinks/profissionais/:profissionalId/servicos`
- `GET /api/v1/trinks/profissionais/categoria/:servicoCategoriaEstabelecimentoId`

### Serviços

- `GET /api/v1/trinks/servicos`

## Observações de negócio e MVP

O backend ainda não suporta:

- persistência local em banco de dados
- autenticação de usuários ou clientes
- fluxo completo de agendamento com regras de negócio do Booking Hub
- separação completa de domínio e aplicação

O comportamento atual é principalmente de adaptação da API Trinks para um backend central e controlado, com validações locais e tratamento de erro padronizado.

## Documentação e exposição

A aplicação gera a documentação Swagger em:

- `http://localhost:3000/docs`

A API também habilita CORS e usa prefixo global `api/v1` em todos os endpoints.

## Resumo do estado atual

O sistema está em uma fase inicial, mas já funcional como backend de integração. A parte mais relevante implementada é a ponte entre o Booking Hub e a Trinks para consulta e manipulação de dados de agendamento, clientes, profissionais e serviços, sendo adequado para evoluir para regras de negócio e persistência no futuro.
