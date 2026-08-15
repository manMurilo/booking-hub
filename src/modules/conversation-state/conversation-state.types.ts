/**
 * Tipos para o gerenciamento de estado de conversa
 */

/**
 * Etapas do fluxo conversacional
 */
export enum ConversationStage {
  // Inicial
  INITIAL = 'initial',

  // Identificação
  IDENTIFYING = 'identifying',
  IDENTIFIED = 'identified',

  // Cadastro de cliente
  REGISTERING_CPF = 'registering_cpf',
  REGISTERING_NAME = 'registering_name',
  REGISTRATION_COMPLETE = 'registration_complete',

  // Agendamento
  SCHEDULING_SERVICE = 'scheduling_service',
  SCHEDULING_PROFESSIONAL = 'scheduling_professional',
  SCHEDULING_DATE = 'scheduling_date',
  SCHEDULING_TIME = 'scheduling_time',
  SCHEDULING_CONFIRMATION = 'scheduling_confirmation',
  SCHEDULING_COMPLETE = 'scheduling_complete',

  // Cancelamento
  CANCELLING = 'cancelling',
  CANCELLING_CONFIRMATION = 'cancelling_confirmation',
  CANCELLATION_COMPLETE = 'cancellation_complete',

  // Reagendamento
  RESCHEDULING = 'rescheduling',
  RESCHEDULING_DATE = 'rescheduling_date',
  RESCHEDULING_TIME = 'rescheduling_time',
  RESCHEDULING_CONFIRMATION = 'rescheduling_confirmation',
  RESCHEDULING_COMPLETE = 'rescheduling_complete',

  // Consultas
  VIEWING_PLANS = 'viewing_plans',
  VIEWING_SUBSCRIPTIONS = 'viewing_subscriptions',

  // Encerramento
  HANDOVER_TO_HUMAN = 'handover_to_human',
  CONVERSATION_END = 'conversation_end',
}

/**
 * Intenções detectadas pela IA
 */
export enum UserIntention {
  SCHEDULE_APPOINTMENT = 'schedule_appointment',
  CANCEL_APPOINTMENT = 'cancel_appointment',
  RESCHEDULE_APPOINTMENT = 'reschedule_appointment',
  VIEW_PLANS = 'view_plans',
  VIEW_SUBSCRIPTIONS = 'view_subscriptions',
  REGISTER = 'register',
  IDENTIFY = 'identify',
  UNKNOWN = 'unknown',
}

/**
 * Dados de cliente coletados durante a conversa
 */
export interface ClientData {
  phoneNumber?: string; // Vem do WhatsApp (normalizado)
  cpf?: string; // Normalizado (11 dígitos)
  name?: string; // Normalizado (capitalizado)
  clientId?: number; // ID da API Trinks
  firstName?: string; // Primeiro nome extraído
  foundInDatabase?: boolean; // Se foi encontrado na BD
}

/**
 * Dados de agendamento coletados durante a conversa
 */
export interface SchedulingData {
  serviceId?: number; // ID do serviço na Trinks
  serviceName?: string; // Nome do serviço
  serviceDescription?: string; // Descrição interpretada

  professionalId?: number; // ID do profissional na Trinks
  professionalName?: string; // Nome do profissional
  professionalPreference?: string; // Preferência mencionada

  appointmentDate?: Date; // Data do agendamento
  appointmentDateString?: string; // String legível (ex: "segunda-feira, 15/08")
  appointmentTime?: string; // Horário (HH:mm)

  subscriptionId?: number; // ID da assinatura ativa (se houver)
  subscriptionName?: string; // Nome do plano

  appointmentId?: number; // ID do agendamento criado
  availableTimeSlots?: string[]; // Slots disponíveis para sugestão
  selectedFromOptions?: boolean; // Se o cliente escolheu de opções oferecidas

  lastAppointmentId?: number; // Para reagendamento
  lastProfessionalId?: number; // Profissional do último agendamento
  lastServiceId?: number; // Serviço do último agendamento
}

/**
 * Histórico de uma mensagem na conversa
 */
export interface MessageHistory {
  role: 'client' | 'bot'; // Quem enviou
  content: string; // Conteúdo da mensagem
  timestamp: Date; // Quando foi enviada
  stage?: ConversationStage; // Etapa quando foi enviada
}

/**
 * Estado completo da conversa
 */
export interface ConversationState {
  // Identificadores
  conversationId: string; // ID único da conversa
  phoneNumber: string; // Telefone do cliente (normalizado)
  createdAt: Date;
  lastMessageAt: Date;

  // Fluxo
  currentStage: ConversationStage;
  previousStage?: ConversationStage;
  lastIntention?: UserIntention; // Última intenção detectada

  // Dados coletados
  client: ClientData;
  scheduling?: SchedulingData;

  // Contexto
  messageHistory: MessageHistory[];
  oopsCount?: number; // Contador de mensagens fora de contexto
  exaltationLevel?: number; // Nível de agressividade/palavrões (0-10)

  // Controle de fluxo
  isContinuingPreviousFlow?: boolean; // Se retomou um fluxo pausado
  canAskForMoreInfo?: boolean; // Se pode fazer mais perguntas
  requiresHumanHandover?: boolean; // Se precisa de atendente

  // Metadados
  metadata?: Record<string, any>; // Dados adicionais se necessário
}

/**
 * Resposta da IA (para ser enviada ao cliente)
 */
export interface BotResponse {
  message: string; // Mensagem a enviar ao cliente
  stage: ConversationStage; // Próxima etapa
  nextAction?: string; // Ação sugerida (para logging/analytics)
  requiresUserInput?: boolean; // Se aguarda resposta do cliente
  shouldStoreInHistory?: boolean; // Se deve armazenar no histórico
}

/**
 * Resultado do processamento de mensagem
 */
export interface ProcessMessageResult {
  stateUpdated: boolean;
  newStage: ConversationStage;
  extractedData?: {
    intention?: UserIntention;
    entities?: Record<string, any>;
    confidence?: number; // 0 a 1
  };
  response: BotResponse;
  error?: string;
}
