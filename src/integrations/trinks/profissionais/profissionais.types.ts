export interface TrinksProfissionaisResponse<T = unknown> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface TrinksProfissionaisQuery {
  page?: number;
  pageSize?: number;
  nome?: string;
}

export interface TrinksProfissional {
  id: number;
  nome: string;
  [key: string]: unknown;
}

export interface TrinksProfissionalServico {
  id: number;
  nome: string;
  duracaoEmMinutos?: number;
  [key: string]: unknown;
}
