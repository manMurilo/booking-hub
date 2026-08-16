import { Injectable, Logger } from '@nestjs/common';
import { AgendamentosService } from '../../integrations/trinks/agendamentos/agendamentos.service';
import {
  TrinksAgendaQuery,
  TrinksDisponibilidadeResponse,
} from '../../integrations/trinks/agendamentos/agendamentos.types';
import {
  ConversationContext,
  ConversationStep,
  PendingAction,
} from './conversation-flow.types';

interface AvailabilityExecutionResult {
  success: boolean;
  context: ConversationContext;
  responseText: string;
  error?: string;
}

@Injectable()
export class TrinksAvailabilityExecutor {
  private readonly logger = new Logger(TrinksAvailabilityExecutor.name);

  constructor(private readonly agendamentosService: AgendamentosService) {}

  async executeAvailability(
    context: ConversationContext,
    params: Record<string, any> = {},
  ): Promise<AvailabilityExecutionResult> {
    const booking = context.booking;

    if (!booking) {
      return {
        success: false,
        context,
        responseText:
          'Ainda falta o contexto do agendamento para consultar disponibilidade.',
        error: 'ConversationContext sem booking data.',
      };
    }

    const dateValue = this.resolveDateValue(
      params.date ?? booking.appointmentDate,
    );
    const serviceId = Number(params.serviceId ?? booking.serviceId ?? 0);

    if (!dateValue || !serviceId) {
      return {
        success: false,
        context,
        responseText:
          'Ainda faltam dados para consultar disponibilidade. Informe a data e o serviço desejados.',
        error: 'Missing date or service information for availability lookup.',
      };
    }

    const professionalId =
      params.professionalId !== undefined
        ? Number(params.professionalId)
        : booking.professionalId !== undefined
          ? Number(booking.professionalId)
          : undefined;

    const query: TrinksAgendaQuery = {
      data: dateValue,
      servicoId: serviceId,
      ...(professionalId ? { profissionalId: professionalId } : {}),
    };

    try {
      const response = await this.agendamentosService.getDisponibilidade(query);
      const availableSlots = this.collectAvailableSlots(response);

      if (availableSlots.length === 0) {
        const updatedContext: ConversationContext = {
          ...context,
          step: ConversationStep.BOOKING_DATE_SELECTION,
          pendingAction: PendingAction.ASK_USER,
          booking: {
            ...booking,
            appointmentTimeSlots: [],
          },
        };

        return {
          success: false,
          context: updatedContext,
          responseText:
            'Não há disponibilidade para essa data. Escolha outra data ou período e eu consulto novamente.',
          error: 'No availability returned from Trinks for the requested date.',
        };
      }

      const requestedTime = booking.appointmentTime;
      if (requestedTime) {
        if (availableSlots.includes(requestedTime)) {
          const updatedContext: ConversationContext = {
            ...context,
            step: ConversationStep.BOOKING_CONFIRMATION,
            pendingAction: PendingAction.CONFIRM,
            booking: {
              ...booking,
              appointmentTimeSlots: availableSlots,
            },
          };

          return {
            success: true,
            context: updatedContext,
            responseText: `O horário ${requestedTime} está disponível. Tudo certo para confirmar seu agendamento?`,
          };
        }

        const updatedContext: ConversationContext = {
          ...context,
          step: ConversationStep.BOOKING_TIME_SELECTION,
          pendingAction: PendingAction.ASK_USER,
          booking: {
            ...booking,
            appointmentTime: undefined,
            appointmentTimeSlots: availableSlots,
          },
        };

        return {
          success: false,
          context: updatedContext,
          responseText: `O horário ${requestedTime} não está disponível. Os horários disponíveis são: ${availableSlots.join(', ')}. Qual você prefere?`,
          error: 'Requested time is not available for the requested date.',
        };
      }

      const updatedContext: ConversationContext = {
        ...context,
        step: ConversationStep.BOOKING_TIME_SELECTION,
        pendingAction: PendingAction.ASK_USER,
        booking: {
          ...booking,
          appointmentTimeSlots: availableSlots,
        },
      };

      return {
        success: true,
        context: updatedContext,
        responseText: `Ótimo! Há horários disponíveis: ${availableSlots.join(', ')}. Qual você prefere?`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(
        `[TrinksAvailabilityExecutor] Falha ao consultar disponibilidade: ${message}`,
      );

      return {
        success: false,
        context,
        responseText:
          'Não consegui consultar a disponibilidade agora. Tente novamente em alguns instantes.',
        error: message,
      };
    }
  }

  private resolveDateValue(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime())
        ? undefined
        : parsed.toISOString().slice(0, 10);
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? undefined
        : value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? undefined
        : parsed.toISOString().slice(0, 10);
    }

    return undefined;
  }

  private collectAvailableSlots(
    response: TrinksDisponibilidadeResponse,
  ): string[] {
    const slots = new Set<string>();

    for (const professional of response.data ?? []) {
      for (const slot of professional.horariosVagos ?? []) {
        if (slot) {
          slots.add(slot);
        }
      }
    }

    return Array.from(slots).sort((left, right) => left.localeCompare(right));
  }
}
