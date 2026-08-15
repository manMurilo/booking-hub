# Booking Hub

Backend foundation for Booking Hub, implementado em NestJS + TypeScript. A aplicação atual funciona como uma API de integração com a Trinks, concentrando chamadas externas em um único backend antes de expor rotas para o restante do produto.

## Contexto geral da aplicação

A estrutura atual do projeto é:

- Framework principal: NestJS
- Linguagem: TypeScript
- Prefixo global da API: `/api/v1`
- Documentação interativa: `/docs`
- Health check: `/api/v1/health`
- CORS habilitado globalmente
- Validação global via `ValidationPipe`
- Tratamento global de exceções via `HttpExceptionFilter`
- Configuração de ambiente global via `ConfigModule.forRoot({ isGlobal: true })`

A aplicação está organizada em módulos por responsabilidade:

- `src/modules/health` — rota de verificação de saúde do backend
- `src/integrations/trinks` — integração com a API da Trinks
  - `agendamentos` — consulta, criação e atualização de agendamentos
  - `clientes` — listagem e criação de clientes
  - `profissionais` — listagem de profissionais e categorias
  - `servicos` — listagem de serviços

## Estado atual do MVP

- Não há banco de dados implementado nesta fase.
- Não há autenticação/autorizações de usuários.
- O backend atua como gateway para a API externa da Trinks.
- As credenciais e configurações do provedor são lidas por variáveis de ambiente.
- A lógica de negócio ainda é mínima; o foco principal é expor e adaptar chamadas da Trinks em endpoints locais.

## Configuração de ambiente

A aplicação lê as variáveis de ambiente abaixo:

- `TRINKS_API_KEY`
- `TRINKS_BASE_URL`
- `TRINKS_ESTABELECIMENTO_ID`
- `PORT` (opcional; padrão `3000`)

Essas variáveis são exigidas pela classe `TrinksService` para validar e montar as requisições para a API externa.

## Rotas principais

### Saúde

- `GET /api/v1/health`

### Trinks - agendamentos

- `GET /api/v1/trinks/agendamentos`
- `GET /api/v1/trinks/agenda`
- `GET /api/v1/trinks/agendamentos/profissionais`
- `GET /api/v1/trinks/disponibilidade`
- `POST /api/v1/trinks/agendamentos`
- `PUT /api/v1/trinks/agendamentos/:id`
- `PATCH /api/v1/trinks/agendamentos/:agendamentoId/status/cancelado`
- `POST /api/v1/trinks/agendamentos/prepare`

Nota: esses endpoints funcionam como proxy da API Trinks e já estão expostos no backend; o fluxo de negócio local do Booking Hub ainda não foi implementado nesta etapa.

### Trinks - clientes

- `GET /api/v1/trinks/clientes`
- `GET /api/v1/trinks/clientes/:id`
- `POST /api/v1/trinks/clientes`

### Trinks - profissionais

- `GET /api/v1/trinks/profissionais`
- `GET /api/v1/trinks/profissionais/:profissionalId/servicos`
- `GET /api/v1/trinks/profissionais/categoria/:servicoCategoriaEstabelecimentoId`

### Trinks - serviços

- `GET /api/v1/trinks/servicos`

## Como executar localmente

1. Instalar dependências:
   ```bash
   npm install
   ```
2. Configurar as variáveis de ambiente em um arquivo `.env`.
3. Iniciar em modo desenvolvimento:
   ```bash
   npm run start:dev
   ```
4. Acesse a documentação Swagger em `http://localhost:3000/docs`.

## Observações de arquitetura

- O projeto ainda não tem camada de persistência ou modelagem de domínio própria.
- Os controllers de integração são finos e delegam para serviços específicos.
- A conversão de datas entre o formato brasileiro e ISO é tratada no helper `TrinksService`.
- O backend envia sempre o `estabelecimentoId` do ambiente, evitando que esse valor seja informado pelo cliente.
