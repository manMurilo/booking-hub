import { Injectable } from '@nestjs/common';
import { ConversationIntent } from '../conversation-state/conversation-flow.types';
import {
  MessageInterpreter,
  MessageInterpretationContext,
  StructuredMessage,
} from './message-interpreter.types';

@Injectable()
export class DeterministicMessageInterpreter implements MessageInterpreter {
  interpret(
    message: string,
    context?: MessageInterpretationContext,
  ): StructuredMessage {
    void context;

    const rawText = message?.trim() ?? '';
    const normalizedText = this.normalize(rawText);
    const intent = this.detectIntent(normalizedText);
    const service = this.extractService(normalizedText);
    const professional = this.extractProfessional(normalizedText);
    const date = this.extractDate(normalizedText);
    const time = this.extractTime(normalizedText);
    const period = this.extractPeriod(normalizedText);
    const confirmation = this.extractConfirmation(normalizedText);
    const cancellation = this.extractCancellation(normalizedText);

    const missingFields = this.buildMissingFields({
      intent,
      service,
      professional,
      date,
      time,
      period,
      confirmation,
      cancellation,
    });

    return {
      intent,
      service,
      professional,
      date,
      time,
      period,
      confirmation,
      cancellation,
      rawText,
      normalizedText,
      missingFields,
    };
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private detectIntent(value: string): ConversationIntent {
    if (
      /(quero|gostaria|preciso|posso)\s+(agendar|marcar|reservar)|\b(agendar|marcar|reservar)\b/.test(
        value,
      )
    ) {
      return ConversationIntent.BOOKING;
    }

    if (
      /\b(duvida|dúvida|informacao|informação|consulta|saber)\b/.test(value)
    ) {
      return ConversationIntent.INQUIRY;
    }

    if (/\b(suporte|atendente|problema|erro|ajuda|urgente)\b/.test(value)) {
      return ConversationIntent.SUPPORT;
    }

    if (
      /\b(cancelar|desmarcar|cancelamento|remarcar|reagendar)\b/.test(value)
    ) {
      return ConversationIntent.BOOKING;
    }

    return ConversationIntent.UNKNOWN;
  }

  private extractService(value: string): string | null {
    const patterns = [
      'corte',
      'barba',
      'sobrancelha',
      'cabelo',
      'hidratação',
      'hidratacao',
      'coloração',
      'coloracao',
      'pigmentação',
      'pigmentacao',
    ];

    for (const pattern of patterns) {
      if (value.includes(pattern)) {
        return pattern;
      }
    }

    return null;
  }

  private extractProfessional(value: string): string | null {
    const match = value.match(
      /(?:com|profissional|com o|com a)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2})/i,
    );

    return match ? match[1].trim() : null;
  }

  private extractDate(value: string): string | null {
    const relativeMatches = [
      { pattern: /\bhoje\b/, days: 0 },
      { pattern: /\bamanha\b/, days: 1 },
      { pattern: /\bdepois de amanha\b/, days: 2 },
      { pattern: /\beste fim de semana\b/, days: 3 },
    ];

    for (const relativeMatch of relativeMatches) {
      if (relativeMatch.pattern.test(value)) {
        return this.addDays(relativeMatch.days);
      }
    }

    const dayMap = new Map<string, number>([
      ['domingo', 0],
      ['segunda', 1],
      ['terca', 2],
      ['quarta', 3],
      ['quinta', 4],
      ['sexta', 5],
      ['sabado', 6],
    ]);

    for (const [label, targetDayIndex] of dayMap.entries()) {
      if (value.includes(label)) {
        const todayIndex = new Date().getDay();
        const delta = (targetDayIndex - todayIndex + 7) % 7 || 7;
        return this.addDays(delta);
      }
    }

    const explicitDateMatch = value.match(
      /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})|\b(\d{4})-(\d{2})-(\d{2})\b/,
    );

    if (explicitDateMatch) {
      const normalized = explicitDateMatch[0].replace(/\//g, '-');
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }

    return null;
  }

  private extractTime(value: string): string | null {
    const hourPattern = value.match(/\b(\d{1,2})\s*(?:h|hr|hrs|hora|horas)\b/i);
    if (hourPattern) {
      return this.formatHour(Number(hourPattern[1]));
    }

    const clockPattern = value.match(/\b(\d{1,2}):(\d{2})\b/);
    if (clockPattern) {
      const hour = Number(clockPattern[1]);
      const minute = Number(clockPattern[2]);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
    }

    return null;
  }

  private extractPeriod(
    value: string,
  ): 'morning' | 'afternoon' | 'evening' | 'night' | null {
    if (/\b(manha|manha)\b/.test(value)) {
      return 'morning';
    }

    if (/\b(tarde)\b/.test(value)) {
      return 'afternoon';
    }

    if (/\b(noite|noit)\b/.test(value)) {
      return 'evening';
    }

    return null;
  }

  private extractConfirmation(value: string): boolean | null {
    if (/\b(confirmo|sim|ok|certo|tudo certo|confirmar)\b/.test(value)) {
      return true;
    }

    if (/\b(nao|não)\b/.test(value) && /\b(confirmar|confirmo)\b/.test(value)) {
      return false;
    }

    return null;
  }

  private extractCancellation(value: string): boolean | null {
    if (/\b(cancelar|desmarcar|cancelamento|nao quero)\b/.test(value)) {
      return true;
    }

    return null;
  }

  private buildMissingFields(params: {
    intent: ConversationIntent;
    service: string | null;
    professional: string | null;
    date: string | null;
    time: string | null;
    period: 'morning' | 'afternoon' | 'evening' | 'night' | null;
    confirmation: boolean | null;
    cancellation: boolean | null;
  }): string[] {
    const missing: string[] = [];

    if (params.intent === ConversationIntent.BOOKING) {
      if (!params.service) {
        missing.push('service');
      }

      if (!params.date) {
        missing.push('date');
      }

      if (!params.time && !params.period) {
        missing.push('time');
      }
    }

    if (params.confirmation === null && params.cancellation === null) {
      return missing;
    }

    return missing;
  }

  private addDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private formatHour(hour: number): string {
    if (hour < 0 || hour > 23) {
      return '00:00';
    }

    return `${String(hour).padStart(2, '0')}:00`;
  }
}
