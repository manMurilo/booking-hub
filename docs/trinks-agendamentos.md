# Integração Trinks — Agendamentos

**Atualizado em:** 14/08/2026

Este documento registra apenas o comportamento conhecido e relevante da integração de agendamentos do Booking Hub com a API da Trinks.

## 1. Configuração

A integração utiliza:

```env
TRINKS_API_KEY=...
TRINKS_BASE_URL=...
TRINKS_ESTABELECIMENTO_ID=232903
```

Headers enviados à Trinks:

```http
X-Api-Key: <TRINKS_API_KEY>
estabelecimentoId: <TRINKS_ESTABELECIMENTO_ID>
```

O estabelecimento utilizado no MVP é:

```text
232903 — Crazy Dog Barber
```

O `estabelecimentoId` vem da configuração do servidor e não deve ser fornecido pelo usuário.

## 2. Listar agendamentos

API Trinks:

```http
GET /v1/agendamentos
```

A integração interna expõe:

```http
GET /api/v1/trinks/agendamentos
```

Parâmetros suportados atualmente:

- `page`
- `pageSize`
- `clienteId`
- `dataInicio`
- `dataFim`

A resposta da Trinks é paginada. O Booking Hub não percorre automaticamente todas as páginas.

### Datas

O serviço normaliza datas informadas no formato brasileiro para o formato ISO usado pela consulta da Trinks.

Exemplo:

```text
12/08/2026
→ dataInicio=2026-08-12T00:00:00
→ dataFim=2026-08-12T23:59:59
```

### Estrutura conhecida

Um agendamento retornado pela Trinks possui, entre outros:

```json
{
  "id": 519508283,
  "status": {
    "id": 4,
    "nome": "Confirmado"
  },
  "cliente": {
    "id": 80726709,
    "nome": "Francisco vinicius mata"
  },
  "servico": {
    "id": 13669508,
    "nome": "Corte"
  },
  "profissional": {
    "id": 781497,
    "nome": "tailan de jesus dos santos"
  },
  "dataHoraInicio": "2026-08-12T19:00:00",
  "duracaoEmMinutos": 40,
  "valor": 45
}
```

## 3. Agenda de profissionais

Recurso da Trinks utilizado pelo projeto:

```http
GET /v1/agendamentos/profissionais/{data}
```

A integração interna expõe o mesmo recurso por:

```http
GET /api/v1/trinks/agenda
GET /api/v1/trinks/agendamentos/profissionais
```

Parâmetros suportados pelo controller:

- `data`
- `servicoId`
- `servicoDuracao`
- `profissionalId`
- `intervalos`
- `page`
- `excluirExcecoesDeAgendamentoOnline`

A resposta é retornada sem transformação estrutural adicional na camada de integração.

Exemplo conhecido:

```json
{
  "id": 781473,
  "nome": "Danilo alves",
  "horariosVagos": [
    "14:00",
    "14:30",
    "15:00"
  ],
  "intervalosVagos": [
    {
      "inicio": "14:00",
      "fim": "17:30"
    }
  ]
}
```

Esse recurso é a principal fonte de disponibilidade utilizada pela camada Booking.

## 4. Disponibilidade

O Booking Hub possui:

```http
GET /api/v1/trinks/disponibilidade
```

`data` é obrigatório.

Os demais filtros são os mesmos utilizados pela consulta de agenda.

Também existe uma camada Booking que transforma os `horariosVagos` em slots:

```text
GET /api/v1/api/booking/agenda/disponivel
```

> A rota acima contém atualmente a duplicação `api/v1/api` causada pelo decorator do controller e pelo prefixo global. Essa inconsistência ainda precisa ser corrigida.

## 5. Criação de agendamento

API Trinks:

```http
POST /v1/agendamentos
```

Endpoint atual do Booking Hub:

```http
POST /api/v1/trinks/agendamentos
```

Payload utilizado:

```json
{
  "servicoId": 0,
  "clienteId": 0,
  "profissionalId": null,
  "dataHoraInicio": "2026-01-01T00:00:00",
  "duracaoEmMinutos": 0,
  "valor": 0,
  "observacoes": null,
  "confirmado": false
}
```

A integração valida os tipos básicos, prepara o request e encaminha para a Trinks.

Também existe:

```http
POST /api/v1/trinks/agendamentos/prepare
```

Esse endpoint é apenas um helper para preparar o payload; não representa o fluxo de negócio completo do Booking Hub.

## 6. Edição de agendamento

Endpoint interno:

```http
PUT /api/v1/trinks/agendamentos/:id
```

A operação encaminha a edição para a Trinks.

Ela ainda não está protegida por um fluxo de negócio completo do produto.

## 7. Cancelamento

Endpoint interno:

```http
PATCH /api/v1/trinks/agendamentos/:agendamentoId/status/cancelado
```

Payload aceito pela integração:

```json
{
  "quemCancelou": 0,
  "motivo": "Motivo do cancelamento"
}
```

O endpoint encaminha a operação para a Trinks.

Ainda não existe um fluxo conversacional de cancelamento implementado no Booking Hub.

## 8. Confirmação

O código atual não possui uma rota interna dedicada para:

```http
PATCH /v1/agendamentos/{agendamentoId}/status/confirmado
```

Portanto, não considerar confirmação como funcionalidade implementada no Booking Hub.

## 9. Dados reais conhecidos para validação

Foi identificado no estabelecimento um agendamento real com:

```text
Agendamento: 518142634
Serviço:     13641157
Profissional: 781497
Data:        2026-10-24
Horário:     15:30
Duração:     60 minutos
Status:      Confirmado
Valor:       90
```

Esses dados podem ser usados como referência para testes controlados de leitura.

## 10. Limites da API Trinks

Limites conhecidos:

```text
60 requisições/minuto
5.000 requisições/mês
```

Excesso pode retornar:

```http
429 Too Many Requests
```

O projeto não implementa retry automático nem rate limiter complexo neste momento.

## 11. Estado atual

### Implementado

- autenticação por API Key;
- `estabelecimentoId` configurado por ambiente;
- consulta de agendamentos;
- filtros de período e cliente;
- paginação;
- normalização de datas;
- consulta de agenda por profissional/data;
- consulta de disponibilidade;
- criação de agendamento como integração;
- edição de agendamento como integração;
- cancelamento como integração;
- preparação de payload de criação.

### Ainda não implementado como produto

- fluxo completo de agendamento orientado por conversa;
- confirmação conversacional;
- cancelamento conversacional;
- reagendamento conversacional;
- regras de negócio completas independentes da Trinks;
- persistência local.

## 12. Próximo foco

A prioridade é consolidar as operações de clientes e agendamentos na camada Booking e validar cada operação contra a API real antes de avançar para automação conversacional completa.
