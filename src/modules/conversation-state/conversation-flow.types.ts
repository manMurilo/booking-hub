/**
 * Tipos para o orquestrador de fluxo conversacional
 * Define intenções, etapas, ações e o contexto de conversa estruturado
 */

/**
 * Intenção detectada pela IA em uma mensagem
 * Guia o fluxo de decisão do backend
 */
export enum ConversationIntent {
  // Operação de negócio
  BOOKING = 'booking',

  // Informações e dúvidas
  INQUIRY = 'inquiry',

  // Suporte e problemas
  SUPPORT = 'support',

  // Não identificado
  UNKNOWN = 'unknown',
}

/**
 * Etapa atual do fluxo conversacional
 * Representa o ponto exato em que a conversa se encontra
 */
export enum ConversationStep {
  // Início
  INITIAL = 'initial',

  // Fase de intenção
  AWAITING_INTENTION = 'awaiting_intention',

  // Fase de identificação do cliente
  CLIENT_IDENTIFICATION = 'client_identification',

  // Fase de registro de novo cliente
  CLIENT_REGISTRATION = 'client_registration',

  // Fase de agendamento - coleta de dados
  BOOKING_SERVICE_SELECTION = 'booking_service_selection',
  BOOKING_PROFESSIONAL_SELECTION = 'booking_professional_selection',
  BOOKING_DATE_SELECTION = 'booking_date_selection',
  BOOKING_AVAILABILITY_CONSULTATION = 'booking_availability_consultation',
  BOOKING_TIME_SELECTION = 'booking_time_selection',

  // Fase de confirmação
  BOOKING_CONFIRMATION = 'booking_confirmation',

  // Encerramento
  HANDOVER_TO_HUMAN = 'handover_to_human',
  COMPLETED = 'completed',
}

/**
 * Ação pendente que o sistema deve tomar
 * Separa a decisão (qual é o próximo passo) da execução (quem faz o quê)
 */
export enum PendingAction {
  // Sem ação
  NONE = 'none',

  // Interação com usuário
  ASK_USER = 'ask_user',
  WAIT_USER_RESPONSE = 'wait_user_response',
  CONFIRM = 'confirm',

  // Interação com Trinks
  CONSULT_TRINKS = 'consult_trinks',
  EXECUTE_TRINKS_ACTION = 'execute_trinks_action',

  // Encerramento
  HANDOVER = 'handover',
  FINISH = 'finish',
}

/**
 * Dados de um cliente dentro do contexto de conversa
 */
export interface ClientContextData {
  // Identificação
  identified: boolean; // Se o cliente foi encontrado/identificado
  id?: number; // ID na Trinks (quando identificado)
  name?: string; // Nome completo
  firstName?: string; // Primeiro nome
  phone: string; // Telefone normalizado
  cpf?: string; // CPF normalizado (11 dígitos)

  // Status
  isNewClient?: boolean; // Se precisa ser registrado
  foundInDatabase?: boolean; // Se foi encontrado na Trinks
  waitingForRegistration?: boolean; // Aguardando registro

  // Dados pendentes para registro
  pendingName?: boolean;
  pendingCPF?: boolean;
}

/**
 * Dados de agendamento coletados durante a conversa
 */
export interface BookingContextData {
  // Serviço
  serviceId?: number;
  serviceName?: string;

  // Profissional
  professionalId?: number; // Opcional
  professionalName?: string; // Opcional

  // Data e horário
  appointmentDate?: Date; // Data do agendamento
  appointmentDateString?: string; // Versão formatada legível
  appointmentTime?: string; // Horário em HH:mm
  appointmentTimeSlots?: string[]; // Slots disponíveis para sugestão

  // Confirmação
  isConfirmed?: boolean;
  confirmedAt?: Date;

  // Resultado
  appointmentId?: number; // ID após criação na Trinks
}

/**
 * Contexto completo da conversa estruturado
 * Representa o estado atual de forma determinística
 * Usado pelo orquestrador para decidir o próximo passo
 */
export interface ConversationContext {
  // Identificadores
  conversationId: string; // ID único da conversa
  phoneNumber: string; // Telefone normalizado

  // Intenção e fluxo
  intent: ConversationIntent;
  previousIntent?: ConversationIntent;

  step: ConversationStep;
  previousStep?: ConversationStep;

  // Ação pendente
  pendingAction: PendingAction;

  // Dados coletados
  client: ClientContextData;
  booking?: BookingContextData;

  // Timestamps
  createdAt: Date;
  lastMessageAt: Date;
  lastIntentionRecognizedAt?: Date;

  // Controle de fluxo
  isRetryingAfterError?: boolean; // Retentativa após erro
  errorMessage?: string; // Mensagem de erro se houver
  cancelledAt?: Date; // Se foi cancelado

  // Metadados adicionais
  metadata?: Record<string, any>;
}

/**
 * Decisão do orquestrador sobre o próximo passo
 * Resultado da avaliação do contexto atual
 */
export interface FlowDecision {
  // Navegação
  nextStep: ConversationStep;
  action: PendingAction;

  // Comunicação
  messageToUser?: string; // O que perguntar/informar
  options?: Array<{ label: string; value: string }>; // Opções para escolha
  requiresConfirmation?: boolean; // Se precisa confirmar

  // Integração
  trinksOperation?: {
    operation:
      'GET_AVAILABILITY' | 'CREATE_BOOKING' | 'GET_CLIENT' | 'CREATE_CLIENT';
    params: Record<string, any>;
  };

  // Histórico
  reason?: string; // Por que tomou essa decisão (para debug)
}

/**
 * Resultado de uma tentativa de avançar no fluxo
 */
export interface FlowAdvanceResult {
  success: boolean;
  context: ConversationContext;
  decision: FlowDecision;
  error?: string;
}
