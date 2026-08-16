import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationContext,
  ConversationIntent,
  BookingContextData,
} from '../conversation-state/conversation-flow.types';
import { StructuredMessage } from './message-interpreter.types';

/**
 * Serviço que atualiza o ConversationContext baseado em um StructuredMessage
 * Responsável por combinar os dados interpretados com o contexto existente
 * seguindo as regras de preservação de estado
 *
 * Regras:
 * - Se intent do StructuredMessage é UNKNOWN, preservar intent existente
 * - Se intent é válido, atualizar contexto
 * - Dados de booking só são substituídos se houver novo valor
 * - Informações já existentes não são apagadas
 */
@Injectable()
export class MessageContextUpdaterService {
  private readonly logger = new Logger(MessageContextUpdaterService.name);

  /**
   * Atualiza o ConversationContext com dados do StructuredMessage
   * Preserva dados existentes quando a nova mensagem não fornece valor
   *
   * @param context Contexto atual da conversa
   * @param structuredMessage Mensagem estruturada interpretada
   * @returns Contexto atualizado
   */
  updateContextFromStructuredMessage(
    context: ConversationContext,
    structuredMessage: StructuredMessage,
  ): ConversationContext {
    const updated = { ...context };

    this.logger.debug(
      `[MessageContextUpdater] Atualizando contexto\n` +
        `   Conversa: ${context.conversationId}\n` +
        `   Intent interpretado: ${structuredMessage.intent}\n` +
        `   Dados: service=${structuredMessage.service}, date=${structuredMessage.date}, time=${structuredMessage.time}`,
    );

    // Atualizar intenção apenas se for válida (não UNKNOWN)
    if (structuredMessage.intent !== ConversationIntent.UNKNOWN) {
      this.logger.debug(
        `[MessageContextUpdater] Atualizando intent de ${updated.intent} para ${structuredMessage.intent}`,
      );
      updated.previousIntent = updated.intent;
      updated.intent = structuredMessage.intent;
    } else {
      this.logger.debug(
        `[MessageContextUpdater] Intent UNKNOWN - preservando ${updated.intent}`,
      );
    }

    // Atualizar dados de booking preservando dados existentes
    if (
      structuredMessage.intent === ConversationIntent.BOOKING ||
      context.intent === ConversationIntent.BOOKING ||
      structuredMessage.service ||
      structuredMessage.professional ||
      structuredMessage.date ||
      structuredMessage.time
    ) {
      updated.booking = this.mergeBookingData(
        updated.booking,
        structuredMessage,
      );
    }

    // Atualizar dados do cliente se fornecidos
    if (structuredMessage.customer) {
      updated.client = this.mergeClientData(updated.client, structuredMessage);
    }

    if (
      structuredMessage.customerExists !== null &&
      structuredMessage.customerExists !== undefined
    ) {
      updated.client = {
        ...updated.client,
        foundInDatabase: structuredMessage.customerExists
          ? updated.client.foundInDatabase
          : false,
        isNewClient: !structuredMessage.customerExists,
        waitingForRegistration: !structuredMessage.customerExists,
        pendingCPF: structuredMessage.customerExists,
      };

      if (structuredMessage.customerExists) {
        updated.metadata = {
          ...updated.metadata,
          identificationByCpf: true,
        };
      }
    }

    if (
      structuredMessage.service ||
      structuredMessage.professional ||
      structuredMessage.date ||
      structuredMessage.time
    ) {
      updated.metadata = {
        ...updated.metadata,
        confirmationDeclined: false,
      };
    }

    // Atualizar confirmação/cancelamento se detectados
    if (structuredMessage.confirmation !== null) {
      if (!updated.booking) {
        updated.booking = {};
      }
      updated.booking.isConfirmed = structuredMessage.confirmation;
      updated.metadata = {
        ...updated.metadata,
        confirmationDeclined: structuredMessage.confirmation === false,
      };
      this.logger.debug(
        `[MessageContextUpdater] Confirmação detectada: ${structuredMessage.confirmation}`,
      );
    }

    if (structuredMessage.cancellation) {
      this.logger.debug(`[MessageContextUpdater] Cancelamento detectado`);
      // Cancelamento é mais uma intenção que será processada pelo orchestrator
      // Aqui apenas registramos no metadata
      if (!updated.metadata) {
        updated.metadata = {};
      }
      updated.metadata.cancellationRequested = true;
    }

    // Atualizar timestamp
    updated.lastMessageAt = new Date();

    this.logger.debug(
      `[MessageContextUpdater] Contexto atualizado\n` +
        `   Intent final: ${updated.intent}\n` +
        `   Service: ${updated.booking?.serviceName}\n` +
        `   Date: ${updated.booking?.appointmentDateString}\n` +
        `   Time: ${updated.booking?.appointmentTime}`,
    );

    return updated;
  }

  /**
   * Combina dados de booking existentes com novos dados do StructuredMessage
   * Preserva valores existentes se a mensagem não fornece o campo
   *
   * @param existing Dados de booking existentes
   * @param structured Mensagem estruturada
   * @returns Dados de booking combinados
   */
  private mergeBookingData(
    existing: BookingContextData | undefined,
    structured: StructuredMessage,
  ): BookingContextData {
    const merged: BookingContextData = { ...existing };

    // Atualizar serviço apenas se fornecido
    if (structured.service) {
      merged.serviceName = structured.service;
      this.logger.debug(
        `[MessageContextUpdater] Serviço atualizado: ${structured.service}`,
      );
    }

    // Atualizar profissional apenas se fornecido
    if (structured.professional) {
      merged.professionalName = structured.professional;
      this.logger.debug(
        `[MessageContextUpdater] Profissional atualizado: ${structured.professional}`,
      );
    }

    // Atualizar data apenas se fornecida
    if (structured.date) {
      merged.appointmentDateString = structured.date;
      merged.appointmentDate = this.resolveDate(structured.date);
      this.logger.debug(
        `[MessageContextUpdater] Data atualizada: ${structured.date}`,
      );
    }

    // Atualizar horário apenas se fornecido
    if (structured.time) {
      merged.appointmentTime = structured.time;
      this.logger.debug(
        `[MessageContextUpdater] Horário atualizado: ${structured.time}`,
      );
    }

    return merged;
  }

  private resolveDate(value: string): Date {
    const normalized = value.trim().toLowerCase();
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (normalized === 'hoje') {
      return date;
    }

    if (normalized === 'amanha' || normalized === 'amanhã') {
      date.setDate(date.getDate() + 1);
      return date;
    }

    if (
      normalized === 'depois de amanha' ||
      normalized === 'depois de amanhã'
    ) {
      date.setDate(date.getDate() + 2);
      return date;
    }

    const weekdayNames = [
      'domingo',
      'segunda',
      'terca',
      'quarta',
      'quinta',
      'sexta',
      'sabado',
    ];
    const weekdayIndex = weekdayNames.indexOf(normalized);
    if (weekdayIndex >= 0) {
      const daysUntil = (weekdayIndex - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
      return date;
    }

    const brazilianDate = normalized.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/,
    );
    if (brazilianDate) {
      const year = Number(
        brazilianDate[3].length === 2
          ? `20${brazilianDate[3]}`
          : brazilianDate[3],
      );
      return new Date(
        year,
        Number(brazilianDate[2]) - 1,
        Number(brazilianDate[1]),
      );
    }

    const isoDate = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(isoDate.getTime()) ? date : isoDate;
  }

  /**
   * Combina dados do cliente existentes com novos dados do StructuredMessage

   * Preserva valores existentes se a mensagem não fornece o campo
   *
   * @param existing Dados do cliente existentes
   * @param structured Mensagem estruturada
   * @returns Dados do cliente combinados
   */
  private mergeClientData(existing: any, structured: StructuredMessage): any {
    const merged = { ...existing };

    if (structured.customer?.name) {
      merged.name = structured.customer.name;
      this.logger.debug(
        `[MessageContextUpdater] Nome do cliente: ${structured.customer.name}`,
      );
    }

    if (structured.customer?.phone) {
      merged.phone = structured.customer.phone;
    }

    if (structured.customer?.cpf) {
      merged.cpf = structured.customer.cpf;
    }

    return merged;
  }
}
