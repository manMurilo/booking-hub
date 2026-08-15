export interface BeneficioDTO {
  tipo?: string | null;
  nome?: string | null;
  valorUnitario?: number;
  consumoLimitado?: boolean;
  cicloDeConsumo?: 'Especifico' | 'Mensal';
  prazoParaConsumo?: number | null;
  quantidadeMaximaConsumo?: number | null;
  [key: string]: unknown;
}

export interface BeneficioDoPlanoDTO {
  beneficio?: BeneficioDTO;
  ativo?: boolean;
  dataDeInclusao?: string;
  dataDeDesativacao?: string | null;
  [key: string]: unknown;
}

export interface PlanoClienteDTO {
  id: number;
  nome?: string | null;
  descricao?: string | null;
  permiteConsumoAteFimPeriodoPago?: boolean;
  dataCriacao?: string;
  valor?: number;
  ativo?: boolean;
  cicloDeCobranca?:
    'NaoInformado' | 'Diario' | 'Mensal' | 'Anual' | 'Trimestre' | 'Semestre';
  quantidadeDeCobrancas?: number | null;
  itens?: BeneficioDoPlanoDTO[] | null;
  [key: string]: unknown;
}

export interface PlanosResponse<T = unknown> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface PlanosQuery {
  page?: number;
  pageSize?: number;
  somenteAtivos?: boolean;
  ordenarPor?: 'AssinaturasMaisRecente' | 'Nome' | 'Status';
  nome?: string;
}
