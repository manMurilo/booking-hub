# Integração Trinks — Agendamentos

Esta documentação registra o comportamento conhecido da integração do Booking Hub com os recursos de agendamento da API Trinks.

## Contexto atual do sistema

O fluxo de agendamento da aplicação continua sendo uma integração direta com a Trinks, sem camada local de persistência e sem regras de negócio próprias. O backend atua como fachada da API externa e expõe endpoints controlados por `src/integrations/trinks`.

Para uma visão mais ampla da arquitetura atual do projeto, consulte o documento [contexto-geral-da-aplicacao.md](./contexto-geral-da-aplicacao.md) e o [README.md](../README.md).

## Visão geral da implementação atual

O Booking Hub expõe dois grupos de rotas para agendamento:

### 1) Proxy Trinks já implementado

- `GET /api/v1/trinks/agendamentos`
- `GET /api/v1/trinks/agenda`
- `GET /api/v1/trinks/agendamentos/profissionais`
- `GET /api/v1/trinks/disponibilidade`
- `POST /api/v1/trinks/agendamentos`
- `PUT /api/v1/trinks/agendamentos/:id`
- `PATCH /api/v1/trinks/agendamentos/:agendamentoId/status/cancelado`
- `POST /api/v1/trinks/agendamentos/prepare`

### 2) Fluxo de negócio local ainda não implementado

- criação local completa de agendamento com regras do Booking Hub
- persistência local de agendamentos
- confirmação/cancelamento com regras próprias do sistema
- modelagem de domínio local do agendamento

Nesse momento, o backend já aplica uma camada mínima de validação local antes de encaminhar a criação para a Trinks: verifica cliente, serviço, profissional e disponibilidade básica do profissional para o horário solicitado.

## Configuração

A integração utiliza as seguintes variáveis de ambiente:

- `TRINKS_API_KEY` — chave de autenticação enviada em `X-Api-Key`
- `TRINKS_ESTABELECIMENTO_ID` — identificador do estabelecimento usado pela integração
- `TRINKS_BASE_URL` — base URL da API Trinks

O estabelecimento utilizado atualmente no MVP é:

- Nome: Crazy Dog Barber
- ID: `232903`

> Nunca registrar a API Key real na documentação ou no repositório.

## Autenticação

A API Trinks usa autenticação por cabeçalho:

```
X-Api-Key: <TRINKS_API_KEY>
```

No Booking Hub, o `estabelecimentoId` sempre deve vir da variável de ambiente `TRINKS_ESTABELECIMENTO_ID` e não deve ser fornecido pelo usuário.

## 1. Proxy: listar agendamentos

Endpoint:

```
GET /v1/agendamentos
```

Parâmetros:

- `page`
- `pageSize`
- `clienteId`
- `dataInicio`
- `dataFim`
- `estabelecimentoId` (obrigatório)

Notas:

- `estabelecimentoId` é obrigatório.
- No Booking Hub, este valor deve ser preenchido internamente a partir de `TRINKS_ESTABELECIMENTO_ID`.
- A resposta possui paginação.
- Atualmente, o Booking Hub não busca automaticamente todas as páginas.

## 2. Proxy: criar agendamento

Endpoint:

```
POST /v1/agendamentos
```

Body esperado:

```json
{
  "servicoId": 0,
  "clienteId": 0,
  "profissionalId": 0,
  "dataHoraInicio": "2026-01-01T00:00:00",
  "duracaoEmMinutos": 0,
  "valor": 0,
  "observacoes": null,
  "confirmado": false
}
```

Parâmetros obrigatórios:

- `servicoId`
- `clienteId`
- `dataHoraInicio`
- `duracaoEmMinutos`
- `valor`
- `estabelecimentoId`

Observações:

- `profissionalId` e `observacoes` podem ser nulos.
- Este endpoint já existe no backend e encaminha a chamada para a Trinks.
- O fluxo de negócio local do Booking Hub continua pendente.

## 3. Obter agendamento (documentado pela API Trinks)

Recurso:

- Obter um agendamento específico por `id`

Parâmetros:

- `id`
- `estabelecimentoId`

Notas:

- Este recurso está documentado, mas ainda não faz parte do fluxo principal implementado do Booking Hub.

## 4. Configurações de agendamento (documentado pela API Trinks)

Endpoint:

```
GET /v1/agendamentos/configuracoes
```

Parâmetro obrigatório:

- `estabelecimentoId`

Notas:

- Este recurso está documentado pela API Trinks, mas ainda não foi integrado ao fluxo do Booking Hub.

## 5. Proxy: editar agendamento

Endpoint:

```
PUT /v1/agendamentos/{id}
```

Body esperado:

- `servicoId`
- `clienteId`
- `profissionalId`
- `dataHoraInicio`
- `duracaoEmMinutos`
- `valor`
- `observacoes`

Notas:

- Este endpoint já foi exposto pelo backend e repassa a alteração para a Trinks.
- A regra de negócio local ainda não foi adicionada ao Booking Hub.

## 6. Confirmar agendamento (ainda não implementado localmente)

Endpoint:

```
PATCH /v1/agendamentos/{agendamentoId}/status/confirmado
```

Parâmetros:

- `agendamentoId`
- `estabelecimentoId`

Notas:

- Esta ação ainda não está implementada no fluxo principal do Booking Hub.

## 7. Proxy: cancelar agendamento

Endpoint:

```
PATCH /v1/agendamentos/{agendamentoId}/status/cancelado
```

Body esperado:

```json
{
  "quemCancelou": 0,
  "motivo": "Motivo do cancelamento"
}
```

Parâmetros:

- `agendamentoId`
- `estabelecimentoId`

Notas:

- Este endpoint já existe e encaminha a operação para a Trinks.
- O cancelamento com regras de negócio locais do Booking Hub ainda não foi implementado.

## 8. Helper de preparação do payload

Endpoint:

```
POST /api/v1/trinks/agendamentos/prepare
```

Descrição:

- prepara o payload para a requisição de criação de agendamento
- centraliza a montagem do corpo usado pela API Trinks
- não representa a regra de negócio local do Booking Hub
- é um helper de integração, não um fluxo de agendamento do produto

## 9. Profissionais com agenda

Este é o recurso mais importante para a próxima etapa do MVP.

Endpoint real confirmado:

```
GET https://api.trinks.com/v1/agendamentos/profissionais/{data}
```

Descrição do recurso:

- Lista os profissionais com agenda do estabelecimento.

Parâmetros disponíveis:

- `data` (obrigatório, em path)
- `intervalos`
- `servicoId`
- `servicoDuracao`
- `profissionalId`
- `page`
- `excluirExcecoesDeAgendamentoOnline`
- `estabelecimentoId` (obrigatório, via header)

Notas:

- `data` é obrigatório como parte do caminho da URL.
- `estabelecimentoId` é obrigatório e deve ser enviado como header a partir de `TRINKS_ESTABELECIMENTO_ID`.
- O serviço envia para a Trinks apenas os parâmetros opcionais que forem informados.
- A resposta da Trinks é atualmente retornada sem transformação adicional pelo Booking Hub.

### Endpoint interno do Booking Hub

Endpoint exposto internamente:

```
GET /api/v1/trinks/agenda
```

Parâmetros aceitos internamente:

- `data`
- `servicoId`
- `servicoDuracao`
- `profissionalId`
- `intervalos`
- `page`
- `excluirExcecoesDeAgendamentoOnline`

Notas:

- O Booking Hub encaminha apenas os parâmetros opcionais informados.
- A resposta de agenda é retornada sem transformação adicional.

### Exemplo de consulta testada

```
GET /api/v1/trinks/agenda?data=2026-08-12&servicoDuracao=60
```

Resultado conhecido:

- HTTP `200`
- Retornou uma lista vazia com paginação padrão.

Importante:

- Este resultado não é suficiente para concluir que não existem horários disponíveis.

### Dados reais conhecidos para testes

Agendamento real identificado no estabelecimento:

- Agendamento: `518142634`
- Serviço: `13641157`
- Profissional: `781497`
- Data: `2026-10-24`
- Horário: `15:30`
- Duração: `60` minutos
- Status: Confirmado

Exemplos de consulta para testes:

```
GET /api/v1/trinks/agenda?data=2026-10-24&servicoId=13641157&servicoDuracao=60
```

```
GET /api/v1/trinks/agenda?data=2026-10-24&servicoId=13641157&servicoDuracao=60&profissionalId=781497
```

### Pontos de investigação futuros

Ainda precisamos confirmar:

1. formato da resposta;
2. significado de `intervalos`;
3. comportamento de `servicoId`;
4. comportamento de `servicoDuracao`;
5. comportamento de `profissionalId`;
6. como a Trinks representa os horários disponíveis;
7. se o recurso já resolve a disponibilidade ou se será necessário cruzar seus dados com os agendamentos existentes.

## Limites conhecidos da API

A API Trinks tem os seguintes limites conhecidos:

- `60` requisições por minuto
- `5.000` requisições por mês

Quando o limite é excedido, a API retorna:

```
HTTP 429
```

Notas:

- No momento, o Booking Hub não possui retry automático nem rate limiter complexo.
- Não implementar esses mecanismos apenas por causa desta documentação.

## Estado atual da integração

### Implementado

- autenticação com API Key
- configuração do estabelecimento
- consulta de agendamentos
- consulta de profissionais com agenda
- endpoint interno `/api/v1/trinks/agenda`

### Ainda não implementado

- criação de agendamento
- edição de agendamento
- confirmação de agendamento
- cancelamento de agendamento
- regras de disponibilidade
- IA
- WhatsApp
- persistência em banco
