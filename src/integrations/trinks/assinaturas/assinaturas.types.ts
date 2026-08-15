export interface AssinaturaDTO {
  id: number;
  clienteCpf?: string | null;
  clienteNome?: string | null;
  dataAssinatura?: string;
  planoId?: number;
  status?:
    | 'Ativa'
    | 'Atrasada'
    | 'SuspensaPorFaltaDePagamento'
    | 'Cancelada'
    | 'Encerrada'
    | 'AguardandoPagamento'
    | 'CanceladaEmPeriodoDeConsumo';
  valorCobranca?: number;
  dataProximaCobranca?: string | null;
  quantidadeDeCobrancas?: number | null;
  dataCancelamento?: string | null;
  idPessoaQueCancelou?: number | null;
  diaVencimento?: number;
  dataProgramadaEncerramento?: string | null;
  permiteConsumoAteFimPeriodoPago?: boolean;
  podeConsumirItens?: boolean;
  descricao?: string | null;
  [key: string]: unknown;
}

export interface AssinaturasResponse<T = unknown> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface AssinaturasQuery {
  page?: number;
  pageSize?: number;
  clienteCpf?: string;
  clienteNome?: string;
  planoId?: number;
  status?:
    | 'Ativa'
    | 'Atrasada'
    | 'SuspensaPorFaltaDePagamento'
    | 'Cancelada'
    | 'Encerrada'
    | 'AguardandoPagamento'
    | 'CanceladaEmPeriodoDeConsumo';
  ordenarPor?:
    | 'AssinaturaMaisRecente'
    | 'ClienteNome'
    | 'AssinaturaNome'
    | 'Status'
    | 'ProximoPagamento'
    | 'CobrancaEncerraApos';
}
