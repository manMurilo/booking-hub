export interface TrinksClientesResponse<T = unknown> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface TrinksClientesQuery {
  page?: number;
  pageSize?: number;
  nome?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  dataCadastroInicio?: string;
  dataCadastroFim?: string;
  dataAlteracaoCadastralInicio?: string;
  dataAlteracaoCadastralFim?: string;
  incluirDetalhes?: boolean;
}

export interface TrinksCliente {
  id: number;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefones?: string[] | null;
  dataCadastro?: string | null;
  dataAlteracaoCadastral?: string | null;
  [key: string]: unknown;
}
