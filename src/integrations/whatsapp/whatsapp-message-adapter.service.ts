import { Injectable, Logger } from '@nestjs/common';
import {
  IWhatsAppConnection,
  WhatsAppIncomingMessage,
  WhatsAppOutgoingMessage,
} from './whatsapp-integration.types';

/**
 * WhatsAppMessageAdapterService
 * Normaliza mensagens entre o formato interno e a implementação de transporte (Baileys)
 *
 * Responsabilidades:
 * - Extrair informações essenciais das mensagens do Baileys
 * - Manter formato consistente independente da implementação
 * - Abstrair detalhes técnicos do Baileys do resto da aplicação
 *
 * NÃO executa lógica de negócio de WhatsApp.
 * É apenas uma camada de adaptação/normalização.
 */
@Injectable()
export class WhatsAppMessageAdapterService {
  private readonly logger = new Logger(WhatsAppMessageAdapterService.name);

  constructor() {}

  /**
   * Normalizar mensagem recebida do Baileys para formato interno
   * Extrai apenas os dados necessários
   */
  normalizeIncomingMessage(message: WhatsAppIncomingMessage): {
    from: string;
    text: string;
    timestamp: number;
    messageId: string;
  } {
    return {
      from: message.sender, // Número do remetente (ex: "5511987654321")
      text: message.text,
      timestamp: message.timestamp,
      messageId: message.messageId,
    };
  }

  /**
   * Preparar mensagem para envio
   * O WhatsAppService irá chamar com o formato esperado
   */
  prepareOutgoingMessage(to: string, text: string): WhatsAppOutgoingMessage {
    return {
      to,
      text,
    };
  }

  /**
   * Extrair número telefônico válido
   * Aceita formatos variados e retorna normalizado
   */
  normalizePhoneNumber(phone: string): string {
    // Remover caracteres não-dígitos
    const digits = phone.replace(/\D/g, '');

    // Se já tem código de país (55), retornar como está
    if (digits.startsWith('55')) {
      return digits;
    }

    // Se tem 11 dígitos (sem código de país), adicionar 55
    if (digits.length === 11) {
      return '55' + digits;
    }

    // Se tem 9 ou 10 dígitos (número incompleto), adicionar 55 e DDD padrão se necessário
    if (digits.length <= 10) {
      // Assumir DDD 11 se não especificado
      return '55' + (digits.length === 9 ? '11' + digits : digits);
    }

    // Retornar como está
    return digits;
  }

  /**
   * Formatar número para exibição
   */
  formatPhoneForDisplay(phone: string): string {
    const normalized = this.normalizePhoneNumber(phone);
    // Formato: +55 11 98765-4321
    if (normalized.length === 13 && normalized.startsWith('55')) {
      const formatted = normalized.slice(0, 2) + ' ' +
        normalized.slice(2, 4) + ' ' +
        normalized.slice(4, 9) + '-' +
        normalized.slice(9);
      return '+' + formatted;
    }
    return phone;
  }
}
