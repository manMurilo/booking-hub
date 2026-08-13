export interface TrinksServico {
  id: number;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  duracaoEmMinutos?: number | null;
  preco?: number | null;
  valorPromocional?: number | null;
  visivelParaCliente?: boolean | null;
  tipoPreco?: number | null;
  [key: string]: unknown;
}

export interface TrinksServicosResponse<T = unknown> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface TrinksServicosQuery {
  page?: number;
  pageSize?: number;
  nome?: string;
  id?: number;
  ativo?: boolean;
}
