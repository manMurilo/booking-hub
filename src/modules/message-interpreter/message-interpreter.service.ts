import { Injectable } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { ConversationIntent } from '../conversation-state/conversation-flow.types';
import {
  MessageInterpreter,
  MessageInterpretationContext,
  StructuredMessage,
} from './message-interpreter.types';

@Injectable()
export class DeterministicMessageInterpreter implements MessageInterpreter {
  constructor(private readonly aiService?: AIService) {}

  async interpret(
    message: string,
    context?: MessageInterpretationContext,
  ): Promise<StructuredMessage> {
    const rawText = message?.trim() ?? '';
    const normalizedText = this.normalize(rawText);

    const aiStructuredMessage = await this.trySemanticInterpretation(
      rawText,
      context,
    );

    const intent =
      aiStructuredMessage?.intent ??
      this.resolveIntent(normalizedText, context) ??
      ConversationIntent.UNKNOWN;
    const service =
      aiStructuredMessage?.service ??
      this.extractService(normalizedText) ??
      this.extractServicePhrase(normalizedText);
    const professional =
      aiStructuredMessage?.professional ?? this.extractProfessional(normalizedText);
    const date = aiStructuredMessage?.date ?? this.extractDate(normalizedText);
    const time = aiStructuredMessage?.time ?? this.extractTime(normalizedText);
    const period =
      aiStructuredMessage?.period ?? this.extractPeriod(normalizedText);
    const confirmation =
      aiStructuredMessage?.confirmation ?? this.extractConfirmation(normalizedText);
    const cancellation =
      aiStructuredMessage?.cancellation ?? this.extractCancellation(normalizedText);

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

    const confidence = this.calculateConfidence({
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
      confidence,
    };
  }

  private normalize(value: string): string {
    const withoutAccents = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const typoCorrections: Record<string, string> = {
      qeuria: 'queria',
      agndar: 'agendar',
      agend: 'agendar',
      horairo: 'horario',
      marcra: 'marcar',
      marcarr: 'marcar',
      agendametno: 'agendamento',
      agendamentoo: 'agendamento',
      cutar: 'cortar',
      cortr: 'cortar',
      cabeloo: 'cabelo',
      bbara: 'barba',
      pra: 'para',
      qto: 'quanto',
      custaa: 'custa',
      oq: 'o que',
      amanha: 'amanha',
    };

    const cleaned = Object.entries(typoCorrections).reduce((result, [wrong, fixed]) => {
      return result.replace(
        new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
        fixed,
      );
    }, withoutAccents);

    return cleaned.replace(/[?.,!;:()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
  }

  private async trySemanticInterpretation(
    rawText: string,
    context?: MessageInterpretationContext,
  ): Promise<Partial<StructuredMessage> | null> {
    if (!this.aiService || !rawText) {
      return null;
    }

    try {
      const contextSummary = context?.conversation
        ? [
            `intent=${context.conversation.intent ?? 'unknown'}`,
            `servico=${context.conversation.booking?.serviceName ?? 'nao informado'}`,
            `profissional=${context.conversation.booking?.professionalName ?? 'nao informado'}`,
            `data=${context.conversation.booking?.appointmentDateString ?? 'nao informada'}`,
            `periodo=${context.conversation.booking?.appointmentTime ?? 'nao informado'}`,
          ].join('; ')
        : 'sem contexto anterior';

      const aiResponse = await this.aiService.processMessage(rawText, {
        conversationId:
          context?.conversation?.conversationId ?? 'message-interpreter',
        messages: [{ role: 'user', content: `${contextSummary}\n\nMensagem atual: ${rawText}` }],
        systemPrompt:
          'Responda apenas com JSON válido. Campos permitidos: intent, service, professional, date, time, period, confirmation, cancellation, rawText. Use intent como booking, inquiry, support ou unknown. Em português do Brasil. Sempre use context data when relevant.',
      } as any);

      const parsed = this.parseAiResponse(aiResponse.message);
      if (!parsed) {
        return null;
      }

      const intent = this.mapIntent(parsed.intent ?? parsed.action);
      if (intent === ConversationIntent.UNKNOWN && !this.isLikelyBookingIntent(rawText)) {
        return null;
      }

      return {
        intent,
        service: parsed.service ?? parsed.booking?.service ?? null,
        professional: parsed.professional ?? parsed.booking?.professional ?? null,
        date: parsed.date ?? parsed.booking?.date ?? null,
        time: parsed.time ?? parsed.booking?.time ?? null,
        period: this.mapPeriod(parsed.period ?? parsed.booking?.period),
        confirmation:
          typeof parsed.confirmation === 'boolean'
            ? parsed.confirmation
            : null,
        cancellation:
          typeof parsed.cancellation === 'boolean'
            ? parsed.cancellation
            : false,
      };
    } catch {
      return null;
    }
  }

  private parseAiResponse(response: string): Record<string, any> | null {
    const trimmed = response.trim();
    if (!trimmed) {
      return null;
    }

    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
    } catch {
      return null;
    }
  }

  private mapIntent(value: unknown): ConversationIntent {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (['booking', 'book', 'agendamento', 'agendar', 'marcar'].includes(normalized)) {
      return ConversationIntent.BOOKING;
    }

    if (['inquiry', 'inquerito', 'duvida', 'consulta', 'informacao', 'preco', 'preço', 'quanto'].includes(normalized)) {
      return ConversationIntent.INQUIRY;
    }

    if (['support', 'suporte', 'ajuda', 'problema', 'reclamacao', 'reclamação'].includes(normalized)) {
      return ConversationIntent.SUPPORT;
    }

    return ConversationIntent.UNKNOWN;
  }

  private mapPeriod(value: unknown): string | null {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (['morning', 'manha', 'manhã'].includes(normalized)) {
      return 'manhã';
    }

    if (['afternoon', 'tarde'].includes(normalized)) {
      return 'tarde';
    }

    if (['evening', 'night', 'noite'].includes(normalized)) {
      return 'noite';
    }

    return null;
  }

  private isLikelyBookingIntent(value: string): boolean {
    const normalized = this.normalize(value);
    return /(?:quero|queria|qeuria|gostaria|preciso|posso|vou|fazer|marcar|agendar|reservar|agendamento|horario|horario|cortar|barba|cabelo|servico|vaga|marca|marcar)/.test(
      normalized,
    );
  }

  private resolveIntent(
    value: string,
    context?: MessageInterpretationContext,
  ): ConversationIntent {
    if (this.isLikelyBookingIntent(value)) {
      return ConversationIntent.BOOKING;
    }

    if (
      context?.conversation?.intent === ConversationIntent.BOOKING ||
      !!context?.conversation?.booking?.serviceName ||
      !!context?.conversation?.booking?.professionalName
    ) {
      const hasFollowUpBookingSignal =
        /\b(com|com o|com a|profissional|cliente|horario|data|amanha|tarde|manha)\b/.test(
          value,
        ) || /\b(joao|maria|ana|carlos|pedro|lucas|joaozinho)\b/.test(value);

      if (hasFollowUpBookingSignal) {
        return ConversationIntent.BOOKING;
      }
    }

    return this.detectIntent(value);
  }

  private detectIntent(value: string): ConversationIntent {
    if (
      /\b(duvida|informacao|consulta|saber|quanto|preco|preço|custa|disponibilidade|funciona|horario|horario|aberto|servicos|serviços|tem|vaga)\b/.test(value)
    ) {
      return ConversationIntent.INQUIRY;
    }

    if (/\b(suporte|atendente|problema|erro|ajuda|urgente)\b/.test(value)) {
      return ConversationIntent.SUPPORT;
    }

    if (/\b(cancelar|desmarcar|cancelamento|remarcar|reagendar)\b/.test(value)) {
      return ConversationIntent.BOOKING;
    }

    return ConversationIntent.UNKNOWN;
  }

  private extractService(value: string): string | null {
    const lower = this.normalize(value);

    if (/\b(?:cortar|corte)\s+(?:o\s+)?(?:cabelo)\b/.test(lower)) {
      return 'corte de cabelo';
    }

    if (/\b(?:cortar|corte)\s+(?:o\s+)?(?:barba)\b/.test(lower)) {
      return 'corte de barba';
    }

    if (/\b(?:barba)\b/.test(lower)) {
      return 'barba';
    }

    if (/\b(?:corte)\b/.test(lower)) {
      return 'corte';
    }

    if (/\b(?:cabelo|sobrancelha|manicure|pedicure|hidratacao|coloracao|pigmentacao)\b/.test(lower)) {
      return lower.match(/\b(?:cabelo|sobrancelha|manicure|pedicure|hidratacao|coloracao|pigmentacao)\b/)?.[0] ?? null;
    }

    return null;
  }

  private extractServicePhrase(value: string): string | null {
    const phrases = [
      /\b(?:quero|queria|qeuria|gostaria|preciso|posso|vou)\s+(?:.*?\s+)?(?:cortar|corte|barba|sobrancelha)\s+(?:o\s+)?(?:cabelo|barba|sobrancelha)\b/,
    ];

    for (const pattern of phrases) {
      const match = value.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    return null;
  }

  private extractProfessional(value: string): string | null {
    const match = value.match(
      /(?:com|profissional|com o|com a)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2})/i,
    );

    if (!match) {
      return null;
    }

    const professional = match[1].trim();
    const normalizedProfessional = professional.replace(/^o\s+/i, '').trim();
    return this.normalizePersonName(normalizedProfessional);
  }

  private normalizePersonName(value: string): string {
    const lowered = value.toLowerCase();
    const withAccent = lowered
      .replace(/\bjoao\b/g, 'joão')
      .replace(/\bjoaozinho\b/g, 'joãozinho')
      .replace(/\bana\b/g, 'ana');

    return withAccent
      .split(' ')
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ')
      .replace(/Joao\b/g, 'João')
      .replace(/Joaozinho\b/g, 'Joãozinho')
      .replace(/Ana\b/g, 'Ana');
  }

  private extractDate(value: string): string | null {
    const relativeMatches = [
      { pattern: /\bhoje\b/, value: 'hoje' },
      { pattern: /\bamanha\b/, value: 'amanhã' },
      { pattern: /\bdepois\s+de\s+amanha\b/, value: 'depois de amanhã' },
      { pattern: /\beste\s+fim\s+de\s+semana\b/, value: 'este fim de semana' },
      { pattern: /\bdomingo\b/, value: 'domingo' },
      { pattern: /\bsegunda\b/, value: 'segunda' },
      { pattern: /\bterca\b/, value: 'terca' },
      { pattern: /\bquarta\b/, value: 'quarta' },
      { pattern: /\bquinta\b/, value: 'quinta' },
      { pattern: /\bsexta\b/, value: 'sexta' },
      { pattern: /\bsabado\b/, value: 'sábado' },
    ];

    for (const relativeMatch of relativeMatches) {
      if (relativeMatch.pattern.test(value)) {
        return relativeMatch.value;
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

    const wordHourMap = new Map<string, string>([
      ['meia noite', '00:30'],
      ['meia', '00:30'],
      ['quinze', '15:00'],
      ['quatorze', '14:00'],
      ['treze', '13:00'],
      ['doze', '12:00'],
      ['onze', '11:00'],
      ['dez', '10:00'],
      ['nove', '09:00'],
      ['oito', '08:00'],
      ['sete', '07:00'],
      ['seis', '06:00'],
      ['cinco', '05:00'],
      ['quatro', '04:00'],
      ['tres', '03:00'],
      ['dois', '02:00'],
      ['uma', '01:00'],
    ]);

    for (const [label, valueTime] of wordHourMap.entries()) {
      if (value.includes(label)) {
        return valueTime;
      }
    }

    return null;
  }

  private extractPeriod(value: string): string | null {
    if (/\bmanha\b/.test(value)) {
      return 'manhã';
    }

    if (/\btarde\b/.test(value)) {
      return 'tarde';
    }

    if (/\bnoite\b/.test(value)) {
      return 'noite';
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
    if (/\b(cancelar|desmarcar|cancelamento|nao quero|nao quero cancelar)\b/.test(value)) {
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
    period: string | null;
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

      if (!params.time) {
        missing.push('time');
      }

      if (params.service && !params.professional) {
        missing.push('professional');
      }
    }

    return missing;
  }

  private calculateConfidence(params: {
    intent: ConversationIntent;
    service: string | null;
    professional: string | null;
    date: string | null;
    time: string | null;
    period: string | null;
    confirmation: boolean | null;
    cancellation: boolean | null;
    rawText: string;
    normalizedText: string;
    missingFields: string[];
  }): number {
    const rawText = params.rawText?.trim() ?? '';

    if (!rawText) {
      return 0.95;
    }

    if (params.intent === ConversationIntent.BOOKING) {
      const explicitBookingSignal = /\b(agendamento|agendar|marcar|horario|horario|reserva|reservar|fazer um horario)\b/.test(
        params.normalizedText,
      );

      if (explicitBookingSignal && !params.service && !params.date && !params.time && !params.professional) {
        return 0.96;
      }

      let score = 0.9;
      if (params.service) score += 0.03;
      if (params.date) score += 0.03;
      if (params.time) score += 0.03;
      if (params.professional) score += 0.02;
      if (params.period) score += 0.01;
      if (params.confirmation !== null || params.cancellation !== null) {
        score += 0.01;
      }
      return Math.min(score, 0.99);
    }

    if (params.intent === ConversationIntent.INQUIRY) {
      let score = 0.88;
      if (params.service) score += 0.03;
      if (params.period) score += 0.02;
      return Math.min(score, 0.99);
    }

    if (params.intent === ConversationIntent.SUPPORT) {
      let score = 0.85;
      if (params.confirmation !== null || params.cancellation !== null) {
        score += 0.04;
      }
      return Math.min(score, 0.99);
    }

    const normalized = this.normalize(rawText);
    if (normalized.length <= 2 || /^(oi|ola|olá|bom dia|boa tarde|boa noite)$/.test(normalized)) {
      return 0.95;
    }

    return 0.72;
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
