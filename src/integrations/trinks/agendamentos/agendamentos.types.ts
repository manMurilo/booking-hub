export interface TrinksAgendamentosResponse<T = unknown> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface TrinksAgendamentosQuery {
  page?: number;
  pageSize?: number;
  clienteId?: number;
  dataInicio?: string;
  dataFim?: string;
}

export interface TrinksAgendaQuery {
  data?: string;
  servicoId?: number;
  servicoDuracao?: number;
  profissionalId?: number;
  intervalos?: number;
  page?: number;
  excluirExcecoesDeAgendamentoOnline?: boolean;
}

export interface TrinksCreateAgendamentoPayload {
  servicoId: number;
  clienteId: number;
  profissionalId?: number | null;
  dataHoraInicio: string;
  duracaoEmMinutos: number;
  valor: number;
  observacoes?: string | null;
  confirmado?: boolean;
}

export interface TrinksCreateAgendamentoRequest {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  body: TrinksCreateAgendamentoPayload;
}

export interface TrinksAgendaProfessionalInterval {
  inicio: string;
  fim: string;
}

export interface TrinksAgendaProfessional {
  id: number;
  nome: string;
  horariosVagos: string[];
  intervalosVagos: TrinksAgendaProfessionalInterval[];
  [key: string]: unknown;
}

export interface TrinksAgendaResponse {
  data: TrinksAgendaProfessional[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export type TrinksDisponibilidadeResponse = TrinksAgendaResponse;
