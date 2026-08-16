import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationContext,
  ConversationIntent,
  ConversationStep,
  PendingAction,
  FlowDecision,
} from './conversation-flow.types';

/**
 * Orquestrador de fluxo conversacional
 * Responsável por determinar o próximo passo da conversa de forma determinística
 * com base no contexto atual e nas regras do fluxo de negócio
 *
 * Recebe:
 * - contexto atual da conversa
 *
 * Avalia:
 * - etapa atual
 * - intenção
 * - dados disponíveis
 * - validações
 *
 * Retorna:
 * - próximo passo
 * - ação a executar
 * - informações para o usuário ou sistema
 */
@Injectable()
export class ConversationFlowOrchestrator {
  private readonly logger = new Logger(ConversationFlowOrchestrator.name);

  /**
   * Determina o próximo passo baseado no contexto atual
   * Implementa as regras do fluxo conversacional definidas na documentação
   *
   * @param context Contexto atual da conversa
   * @returns Decisão sobre o próximo passo
   */
  determineNextStep(context: ConversationContext): FlowDecision {
    this.logger.debug(
      `[FlowOrchestrator] Analisando fluxo. Step: ${context.step}, Intent: ${context.intent}`,
    );

    // Se o contexto está em erro, tentar recuperar
    if (context.isRetryingAfterError) {
      return this.handleErrorRecovery();
    }

    // Fluxo inicial sem intenção definida; quando já há intenção, processá-la no mesmo turno.
    if (
      context.step === ConversationStep.INITIAL &&
      context.intent === ConversationIntent.UNKNOWN
    ) {
      return this.handleInitialStep();
    }

    if (context.step === ConversationStep.INITIAL) {
      return this.handleIntentionStep(context);
    }

    // Fluxo de identificação de intenção
    if (context.step === ConversationStep.AWAITING_INTENTION) {
      return this.handleIntentionStep(context);
    }

    // Fluxo de identificação de cliente
    if (context.step === ConversationStep.CLIENT_IDENTIFICATION) {
      return this.handleClientIdentificationStep(context);
    }

    // Fluxo de registro de cliente
    if (context.step === ConversationStep.CLIENT_REGISTRATION) {
      return this.handleClientRegistrationStep(context);
    }

    // Fluxo de agendamento
    if (context.intent === ConversationIntent.BOOKING) {
      return this.handleBookingFlow(context);
    }

    // Fluxo de consulta/dúvida
    if (context.intent === ConversationIntent.INQUIRY) {
      return this.handleInquiryFlow();
    }

    // Fluxo de suporte
    if (context.intent === ConversationIntent.SUPPORT) {
      return this.handleSupportFlow(context);
    }

    // Fluxo desconhecido
    if (context.intent === ConversationIntent.UNKNOWN) {
      return this.handleUnknownIntentionFlow(context);
    }

    // Fallback - algo inesperado
    return this.createDecision(
      ConversationStep.HANDOVER_TO_HUMAN,
      PendingAction.HANDOVER,
      'Não consegui entender o estado da conversa. Transferindo para atendente.',
      'Estado inesperado - fallback',
    );
  }

  /**
   * Etapa inicial - primeira mensagem do cliente
   * Não identificar cliente logo de cara
   * Seguir o fluxo documentado: primeiro determinar intenção, depois identificar se necessário
   * Ver: docs/fluxo-conversacional.md - "A necessidade de identificação depende da intenção"
   */
  private handleInitialStep(): FlowDecision {
    // Ir diretamente para AWAITING_INTENTION
    // O cliente será identificado SÓ se a intenção exigir (ex: BOOKING, SUPPORT)
    return this.createDecision(
      ConversationStep.AWAITING_INTENTION,
      PendingAction.ASK_USER,
      'Olá! Como posso te ajudar?',
      'Primeira mensagem. Aguardando que o cliente revele sua intenção.',
    );
  }

  /**
   * Etapa de intenção - IA deve ter identificado a intenção
   * Se não conseguiu, retornar ao usuário
   */
  private handleIntentionStep(context: ConversationContext): FlowDecision {
    // Intenção foi reconhecida?
    if (context.intent === ConversationIntent.UNKNOWN || !context.intent) {
      // Primeira vez que não consegue?
      const previousFailed =
        context.previousIntent === ConversationIntent.UNKNOWN;

      if (!previousFailed) {
        // Dar segunda chance
        return this.createDecision(
          ConversationStep.AWAITING_INTENTION,
          PendingAction.ASK_USER,
          'Não consegui entender exatamente o que você precisa. Pode me explicar melhor?',
          'Primeira falha de compreensão.',
        );
      }

      // Já tentou 2 vezes, encaminhar para humano
      return this.createDecision(
        ConversationStep.HANDOVER_TO_HUMAN,
        PendingAction.HANDOVER,
        'Desculpe, não consegui entender como posso te ajudar. Quer falar com uma atendente?',
        'Múltiplas falhas em reconhecer intenção.',
      );
    }

    // Intenção identificada com sucesso, avançar para o fluxo apropriado
    if (context.intent === ConversationIntent.BOOKING) {
      // Para agendamento, precisa de cliente identificado
      if (!context.client.identified) {
        return this.createDecision(
          ConversationStep.CLIENT_IDENTIFICATION,
          PendingAction.CONSULT_TRINKS,
          undefined,
          'Intenção BOOKING detectada. Cliente não identificado, consultando Trinks.',
          {
            operation: 'GET_CLIENT',
            params: { phone: context.phoneNumber },
          },
        );
      }

      // Cliente identificado, iniciar fluxo de agendamento
      return this.createDecision(
        ConversationStep.BOOKING_SERVICE_SELECTION,
        PendingAction.ASK_USER,
        'Qual serviço você gostaria de agendar?',
        'Iniciando fluxo de agendamento com cliente identificado.',
      );
    }

    if (context.intent === ConversationIntent.INQUIRY) {
      // Dúvida não precisa de cliente identificado necessariamente
      // IA responde e conversa encerra
      return this.createDecision(
        ConversationStep.COMPLETED,
        PendingAction.FINISH,
        undefined,
        'Intenção INQUIRY - IA responde e encerra.',
      );
    }

    if (context.intent === ConversationIntent.SUPPORT) {
      // Suporte pode exigir cliente identificado
      if (!context.client.identified) {
        return this.createDecision(
          ConversationStep.CLIENT_IDENTIFICATION,
          PendingAction.CONSULT_TRINKS,
          undefined,
          'Intenção SUPPORT detectada. Cliente não identificado, consultando Trinks.',
          {
            operation: 'GET_CLIENT',
            params: { phone: context.phoneNumber },
          },
        );
      }

      // Encaminhar para atendente humano
      return this.createDecision(
        ConversationStep.HANDOVER_TO_HUMAN,
        PendingAction.HANDOVER,
        'Entendi. Vou te conectar com uma atendente para resolver isso.',
        'SUPPORT requer atendimento humano.',
      );
    }

    return this.createDecision(
      ConversationStep.COMPLETED,
      PendingAction.FINISH,
      undefined,
      'Fluxo de intenção concluído.',
    );
  }

  /**
   * Etapa de identificação de cliente
   * Consultar Trinks pelo telefone
   */
  private handleClientIdentificationStep(
    context: ConversationContext,
  ): FlowDecision {
    // Se já identificado, avançar
    if (context.client.identified) {
      // Retomar o fluxo anterior
      if (
        context.intent === ConversationIntent.BOOKING ||
        context.previousIntent === ConversationIntent.BOOKING
      ) {
        return this.createDecision(
          ConversationStep.BOOKING_SERVICE_SELECTION,
          PendingAction.ASK_USER,
          `Ótimo, ${context.client.firstName}! Qual serviço você gostaria de agendar?`,
          'Cliente identificado. Retomando fluxo de agendamento.',
        );
      }

      if (context.previousIntent === ConversationIntent.SUPPORT) {
        return this.createDecision(
          ConversationStep.HANDOVER_TO_HUMAN,
          PendingAction.HANDOVER,
          `Perfeito, ${context.client.firstName}! Deixe-me conectar você com uma atendente.`,
          'Cliente identificado. Transferindo para suporte.',
        );
      }

      // Padrão
      return this.createDecision(
        ConversationStep.AWAITING_INTENTION,
        PendingAction.WAIT_USER_RESPONSE,
        undefined,
        'Cliente identificado. Aguardando próxima ação do usuário.',
      );
    }

    if (
      context.metadata?.identificationByCpf &&
      context.client.cpf &&
      !context.client.identified
    ) {
      return this.createDecision(
        ConversationStep.CLIENT_IDENTIFICATION,
        PendingAction.CONSULT_TRINKS,
        undefined,
        'Consultando Trinks pelo CPF informado.',
        {
          operation: 'GET_CLIENT',
          params: { cpf: context.client.cpf },
        },
      );
    }

    // Cliente não encontrado na Trinks
    if (
      !context.client.foundInDatabase &&
      !context.metadata?.identificationByCpf
    ) {
      if (context.client.isNewClient || context.client.waitingForRegistration) {
        return this.createDecision(
          ConversationStep.CLIENT_REGISTRATION,
          PendingAction.ASK_USER,
          'Sem problema! Para dar continuidade ao agendamento, me passe seu nome completo e CPF, por favor.',
          'Confirmado novo cliente. Iniciando registro.',
        );
      }

      // Perguntar se é cliente novo
      return this.createDecision(
        ConversationStep.CLIENT_IDENTIFICATION,
        PendingAction.ASK_USER,
        'Você já é cliente da Crazy Dog Barber?',
        'Cliente não encontrado em Trinks. Perguntando se é novo cliente.',
      );
    }

    if (context.metadata?.identificationByCpf && !context.client.cpf) {
      return this.createDecision(
        ConversationStep.CLIENT_IDENTIFICATION,
        PendingAction.ASK_USER,
        'Pode me informar seu CPF para localizar seu cadastro?',
        'Cliente informou que já é cliente; aguardando CPF.',
      );
    }

    // Estado indefinido - consultar Trinks
    return this.createDecision(
      ConversationStep.CLIENT_IDENTIFICATION,
      PendingAction.CONSULT_TRINKS,
      undefined,
      'Consultando Trinks para identificar cliente.',
      {
        operation: 'GET_CLIENT',
        params: { phone: context.phoneNumber },
      },
    );
  }

  /**
   * Etapa de registro de novo cliente
   * Coletar nome e CPF, depois criar na Trinks
   */
  private handleClientRegistrationStep(
    context: ConversationContext,
  ): FlowDecision {
    // Tem nome?
    if (!context.client.name) {
      return this.createDecision(
        ConversationStep.CLIENT_REGISTRATION,
        PendingAction.ASK_USER,
        'Qual é o seu nome completo?',
        'Aguardando nome do cliente.',
      );
    }

    // Tem CPF?
    if (!context.client.cpf) {
      return this.createDecision(
        ConversationStep.CLIENT_REGISTRATION,
        PendingAction.ASK_USER,
        'Qual é o seu CPF?',
        'Aguardando CPF do cliente.',
      );
    }

    // Tem nome e CPF, criar na Trinks
    if (context.client.name && context.client.cpf && !context.client.id) {
      return this.createDecision(
        ConversationStep.CLIENT_REGISTRATION,
        PendingAction.EXECUTE_TRINKS_ACTION,
        undefined,
        'Nome e CPF coletados. Criando cliente na Trinks.',
        {
          operation: 'CREATE_CLIENT',
          params: {
            name: context.client.name,
            cpf: context.client.cpf,
            phone: context.phoneNumber,
          },
        },
      );
    }

    // Cliente criado com sucesso
    if (context.client.id && context.client.identified) {
      // Retomar fluxo anterior
      if (
        context.intent === ConversationIntent.BOOKING ||
        context.previousIntent === ConversationIntent.BOOKING
      ) {
        return this.createDecision(
          ConversationStep.BOOKING_SERVICE_SELECTION,
          PendingAction.ASK_USER,
          `Perfeito! Cadastro realizado, ${context.client.firstName}! Qual serviço você gostaria de agendar?`,
          'Cliente criado na Trinks. Retomando agendamento.',
        );
      }
    }

    return this.createDecision(
      ConversationStep.CLIENT_REGISTRATION,
      PendingAction.WAIT_USER_RESPONSE,
      undefined,
      'Aguardando conclusão do registro.',
    );
  }

  /**
   * Fluxo de agendamento
   * Coletar dados necessários para criar um agendamento
   */
  private handleBookingFlow(context: ConversationContext): FlowDecision {
    // Pré-requisito: cliente identificado
    if (!context.client.identified) {
      return this.createDecision(
        ConversationStep.CLIENT_IDENTIFICATION,
        PendingAction.CONSULT_TRINKS,
        undefined,
        'Agendamento exige cliente identificado.',
      );
    }

    // Etapa: selecionar serviço
    if (!context.booking?.serviceId) {
      return this.createDecision(
        ConversationStep.BOOKING_SERVICE_SELECTION,
        PendingAction.ASK_USER,
        'Qual serviço você gostaria de agendar?',
        'Serviço não informado ainda.',
      );
    }

    // Etapa: selecionar data
    if (!context.booking?.appointmentDate) {
      return this.createDecision(
        ConversationStep.BOOKING_DATE_SELECTION,
        PendingAction.ASK_USER,
        'Qual data você prefere?',
        'Data não informada ainda.',
      );
    }

    // Etapa: consultar disponibilidade na data
    if (context.step === ConversationStep.BOOKING_DATE_SELECTION) {
      return this.createDecision(
        ConversationStep.BOOKING_AVAILABILITY_CONSULTATION,
        PendingAction.CONSULT_TRINKS,
        undefined,
        'Consultando disponibilidade na Trinks.',
        {
          operation: 'GET_AVAILABILITY',
          params: {
            date: context.booking.appointmentDate,
            serviceId: context.booking.serviceId,
            professionalId: context.booking.professionalId,
          },
        },
      );
    }

    // Etapa: selecionar horário
    if (!context.booking?.appointmentTime) {
      const options = context.booking?.appointmentTimeSlots?.map((slot) => ({
        label: slot,
        value: slot,
      }));
      const decision: FlowDecision = {
        nextStep: ConversationStep.BOOKING_TIME_SELECTION,
        action: PendingAction.ASK_USER,
        messageToUser: `Ótimo! Os horários disponíveis são: ${context.booking?.appointmentTimeSlots?.join(', ')}. Qual você prefere?`,
        options,
        reason: 'Horário não informado ainda.',
      };
      return decision;
    }

    if (context.metadata?.confirmationDeclined) {
      return this.createDecision(
        ConversationStep.BOOKING_SERVICE_SELECTION,
        PendingAction.ASK_USER,
        'Tudo bem. O que você gostaria de alterar no agendamento?',
        'Cliente recusou a confirmação; aguardando novos dados.',
      );
    }

    // Confirmação explícita recebida: executar a criação somente agora.
    if (context.booking.isConfirmed === true) {
      return this.createDecision(
        ConversationStep.BOOKING_CONFIRMATION,
        PendingAction.EXECUTE_TRINKS_ACTION,
        undefined,
        'Cliente confirmou o agendamento.',
        {
          operation: 'CREATE_BOOKING',
          params: {},
        },
      );
    }

    // Todos os dados coletados, pedir confirmação
    if (
      context.booking.serviceId &&
      context.booking.appointmentDate &&
      context.booking.appointmentTime
    ) {
      return this.createDecision(
        ConversationStep.BOOKING_CONFIRMATION,
        PendingAction.CONFIRM,
        this.buildConfirmationMessage(context),
        'Todos os dados coletados. Pedindo confirmação.',
        undefined,
        true,
      );
    }

    return this.createDecision(
      ConversationStep.BOOKING_SERVICE_SELECTION,
      PendingAction.ASK_USER,
      'Qual serviço você gostaria de agendar?',
      'Fluxo de agendamento - estado indefinido.',
    );
  }

  /**
   * Fluxo de dúvidas/informações
   * IA responde e encerra
   */
  private handleInquiryFlow(): FlowDecision {
    return this.createDecision(
      ConversationStep.COMPLETED,
      PendingAction.FINISH,
      undefined,
      'INQUIRY - IA responde e encerra conversa.',
    );
  }

  /**
   * Fluxo de suporte
   * Exigir cliente e encaminhar para atendente
   */
  private handleSupportFlow(context: ConversationContext): FlowDecision {
    if (!context.client.identified) {
      return this.createDecision(
        ConversationStep.CLIENT_IDENTIFICATION,
        PendingAction.CONSULT_TRINKS,
        undefined,
        'SUPPORT exige cliente identificado.',
      );
    }

    return this.createDecision(
      ConversationStep.HANDOVER_TO_HUMAN,
      PendingAction.HANDOVER,
      `Entendi, ${context.client.firstName}. Vou te conectar com uma atendente para ajudar.`,
      'SUPPORT - Transferindo para humano.',
    );
  }

  /**
   * Fluxo de intenção desconhecida
   * Tentar novamente ou encaminhar
   */
  private handleUnknownIntentionFlow(
    context: ConversationContext,
  ): FlowDecision {
    // Já tentou 2 vezes?
    const attemptCount = context.metadata?.unknownAttempts ?? 0;

    if (attemptCount < 2) {
      return this.createDecision(
        ConversationStep.AWAITING_INTENTION,
        PendingAction.ASK_USER,
        'Não consegui entender exatamente o que você precisa. Pode me explicar melhor?',
        'Primeira tentativa de esclarecer intenção.',
      );
    }

    return this.createDecision(
      ConversationStep.HANDOVER_TO_HUMAN,
      PendingAction.HANDOVER,
      'Desculpe, não consegui entender como posso te ajudar. Quer falar com uma atendente?',
      'Múltiplas tentativas falhadas. Escalando.',
    );
  }

  /**
   * Recuperação de erro
   * Tentar limpar o estado e retomar
   */
  private handleErrorRecovery(): FlowDecision {
    return this.createDecision(
      ConversationStep.AWAITING_INTENTION,
      PendingAction.ASK_USER,
      `Desculpe, algo deu errado. Como posso te ajudar?`,
      'Recuperando de erro.',
    );
  }

  /**
   * Helper: criar um FlowDecision com valores predefinidos
   */
  private createDecision(
    nextStep: ConversationStep,
    action: PendingAction,
    messageToUser?: string,
    reason?: string,
    trinksOperation?: {
      operation:
        'GET_AVAILABILITY' | 'CREATE_BOOKING' | 'GET_CLIENT' | 'CREATE_CLIENT';
      params: Record<string, any>;
    },
    requiresConfirmation?: boolean,
  ): FlowDecision {
    return {
      nextStep,
      action,
      messageToUser,
      requiresConfirmation,
      trinksOperation,
      reason,
    };
  }

  /**
   * Helper: construir mensagem de confirmação de agendamento
   */
  private buildConfirmationMessage(context: ConversationContext): string {
    const { booking } = context;

    if (!booking) {
      return 'Confirme seu agendamento.';
    }

    const dateStr = booking.appointmentDateString || 'data';
    const timeStr = booking.appointmentTime || 'horário';
    const serviceStr = booking.serviceName || 'serviço';
    const profStr = booking.professionalName
      ? ` com ${booking.professionalName}`
      : '';

    return (
      `Perfeito! Vou confirmar seu agendamento:\n\n` +
      `📅 Data: ${dateStr}\n` +
      `🕐 Horário: ${timeStr}\n` +
      `✂️ Serviço: ${serviceStr}${profStr}\n\n` +
      `Tudo certo?`
    );
  }

  /**
   * Validar se contexto tem dados necessários para agendamento
   */
  isReadyForBooking(context: ConversationContext): boolean {
    return !!(
      context.client.identified &&
      context.booking?.serviceId &&
      context.booking?.appointmentDate &&
      context.booking?.appointmentTime
    );
  }

  /**
   * Coletar dados faltantes para agendamento
   * Retorna nome do campo faltante ou null se todos os dados estão completos
   */
  collectMissingData(context: ConversationContext): string | null {
    if (!context.client.identified) {
      return 'cliente';
    }
    if (!context.booking?.serviceId) {
      return 'serviço';
    }
    if (!context.booking?.appointmentDate) {
      return 'data';
    }
    if (!context.booking?.appointmentTime) {
      return 'horário';
    }
    return null;
  }

  /**
   * Validar dados do cliente
   */
  validateClientData(context: ConversationContext): boolean {
    if (!context.client.identified) {
      return false;
    }

    // Se é cliente novo, precisa ter CPF
    if (context.client.isNewClient && !context.client.cpf) {
      return false;
    }

    return true;
  }
}
