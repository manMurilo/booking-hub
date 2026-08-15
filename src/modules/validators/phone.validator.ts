/**
 * Phone Validator
 * Valida telefones brasileiros no padrão: DDI (2) + DDD (2) + número (9 dígitos)
 */

export class PhoneValidator {
  /**
   * Normaliza telefone removendo pontos, traços, espaços e parênteses
   * @param phone - Telefone com ou sem formatação
   * @returns Telefone com apenas dígitos
   */
  static normalize(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      return '';
    }
    return phone.replace(/\D/g, '');
  }

  /**
   * Valida se o telefone segue o padrão brasileiro
   * Padrão: 2 dígitos DDI + 2 dígitos DDD + 9 dígitos do número = 13 dígitos total
   * @param phone - Telefone com ou sem formatação
   * @returns true se válido, false caso contrário
   */
  static isValid(phone: string): boolean {
    const normalized = this.normalize(phone);

    // Deve ter exatamente 13 dígitos (DDI 2 + DDD 2 + número 9)
    if (normalized.length !== 13) {
      return false;
    }

    // DDI válidos brasileiros geralmente começam com 55
    // Aceitamos apenas DDI 55 para Brasil
    if (!normalized.startsWith('55')) {
      return false;
    }

    // DDD deve ser entre 11 e 99 (válidos no Brasil)
    const ddd = parseInt(normalized.substring(2, 4), 10);
    if (ddd < 11 || ddd > 99) {
      return false;
    }

    // Os 9 dígitos finais não devem ser todos iguais (número fake)
    const numberPart = normalized.substring(4);
    if (/^(\d)\1{8}$/.test(numberPart)) {
      return false;
    }

    // O número não pode começar com 0 (não é válido em padrão brasileiro moderno)
    if (numberPart.startsWith('0')) {
      return false;
    }

    return true;
  }

  /**
   * Formata telefone para exibição
   * Padrão: +55 (DD) 9XXXX-XXXX
   * @param phone - Telefone normalizado (13 dígitos)
   * @returns Telefone formatado
   */
  static format(phone: string): string {
    const normalized = this.normalize(phone);
    if (normalized.length !== 13) {
      return normalized; // Retorna como está se não tiver 13 dígitos
    }
    const ddi = normalized.substring(0, 2);
    const ddd = normalized.substring(2, 4);
    const first = normalized.substring(4, 9);
    const second = normalized.substring(9, 13);

    return `+${ddi} (${ddd}) ${first}-${second}`;
  }

  /**
   * Valida e normaliza telefone de uma só vez
   * @param phone - Telefone com ou sem formatação
   * @returns Objeto com status e telefone normalizado
   */
  static validate(phone: string): { isValid: boolean; normalized: string } {
    const normalized = this.normalize(phone);
    return {
      isValid: this.isValid(normalized),
      normalized,
    };
  }

  /**
   * Extrai o número sem DDI e DDD (apenas os 9 dígitos)
   * @param phone - Telefone normalizado (13 dígitos)
   * @returns Os 9 dígitos do número ou string vazia
   */
  static getNumberPart(phone: string): string {
    const normalized = this.normalize(phone);
    if (normalized.length !== 13) {
      return '';
    }
    return normalized.substring(4);
  }
}
