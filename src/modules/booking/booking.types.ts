/**
 * Tipos e DTOs para o módulo de Booking
 * Respostas de queries, filtros, e modelos de negócio
 */

/**
 * Dados de cliente simplificados para resposta de busca
 */
export interface ClienteSearchResult {
  clienteId: number;
  nome: string;
  primeiroNome: string;
  cpf: string; // normalizado, sempre 11 dígitos
  telefone: string; // normalizado com DDI
  ativo: boolean;
}

/**
 * Resposta ao buscar cliente por telefone/CPF
 */
export interface FindClienteResponse {
  found: boolean;
  cliente?: ClienteSearchResult;
  message?: string; // Mensagem descritiva se não encontrado
}

/**
 * Slot de horário disponível para agendamento
 */
export interface TimeSlot {
  horario: string; // HH:mm
  disponivel: boolean;
  profissionalId?: number;
  profissionalNome?: string;
}

/**
 * Resposta de agenda disponível para um dia específico
 */
export interface AvailabilityResponse {
  data: string; // YYYY-MM-DD
  dataFormatada: string; // Legível: "segunda-feira, 15 de agosto de 2026"
  slots: TimeSlot[];
  totalDisponivel: number;
}

/**
 * Resposta com múltiplos dias de disponibilidade
 */
export interface AvailabilityMultipleDaysResponse {
  profissionalId: number;
  profissionalNome: string;
  servicoId: number;
  servicoNome: string;
  dias: AvailabilityResponse[];
}

/**
 * Plano/Assinatura simplificado para listagem
 */
export interface PlanoResponse {
  planoId: number;
  nome: string;
  descricao: string;
  ativo: boolean;
  servicos?: { servicoId: number; servicoNome: string }[];
}

/**
 * Resposta de listagem de planos
 */
export interface ListPlanosResponse {
  planos: PlanoResponse[];
  total: number;
}

/**
 * Serviço simplificado para listagem
 */
export interface ServicoResponse {
  servicoId: number;
  nome: string;
  descricao: string;
  duracao: number; // em minutos
  ativo: boolean;
}

/**
 * Resposta de listagem de serviços
 */
export interface ListServicosResponse {
  servicos: ServicoResponse[];
  total: number;
}

/**
 * Profissional simplificado para listagem
 */
export interface ProfissionalResponse {
  profissionalId: number;
  nome: string;
  apelido?: string;
  ativo: boolean;
  especialidades?: string[];
}

/**
 * Resposta de listagem de profissionais
 */
export interface ListProfissionaisResponse {
  profissionais: ProfissionalResponse[];
  total: number;
}

/**
 * Query parameters para busca de disponibilidade
 */
export interface AvailabilityQuery {
  profissionalId?: number;
  servicoId?: number;
  dataInicio: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD (se não informado, usa dataInicio)
}

/**
 * Resultado de validação de agendamento
 */
export interface ValidateAppointmentResult {
  valid: boolean;
  reason?: string; // Motivo se for inválido
  clienteId?: number;
  servicoId?: number;
  profissionalId?: number;
  dataHora?: string;
  planoAtivo?: {
    planoId: number;
    nome: string;
    cobre: boolean; // Se cobre este serviço
  };
  conflitos?: string[]; // Possíveis conflitos detectados
}
