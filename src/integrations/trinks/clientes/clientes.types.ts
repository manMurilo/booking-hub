export interface TrinksTelefone {
  ddi: string;
  ddd: string;
  telefone: string;
}

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
  telefones?: TrinksTelefone[] | null;
  dataCadastro?: string | null;
  dataAlteracaoCadastral?: string | null;
  [key: string]: unknown;
}

export interface AddTelefoneDTO {
  ddi?: string | null;
  ddd?: string | null;
  numero?: string | null;
  tipoId?: number | null;
}

export interface ClientePreferenciasDTO {
  recebeSMSLembreteDeAgendamento?: boolean;
  recebeEmailLembreteDeAgendamento?: boolean;
  recebeSMSMarketing?: boolean;
  recebeEmailMarketing?: boolean;
}

export interface AddCliente {
  nome?: string | null;
  email?: string | null;
  cpf?: string | null;
  genero?: string | null;
  sexo?: string | null;
  observacoes?: string | null;
  codigoExterno?: string | null;
  telefones?: AddTelefoneDTO[] | null;
  preferencias?: ClientePreferenciasDTO | null;
}

export interface CreatedIdModel {
  id: number;
}
