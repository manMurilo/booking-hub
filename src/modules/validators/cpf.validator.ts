/**
 * CPF Validator
 * Implementa o algoritmo oficial de validação de CPF brasileiro
 */

export class CpfValidator {
  /**
   * Normaliza CPF removendo pontos, traços e espaços
   * @param cpf - CPF com ou sem formatação
   * @returns CPF com apenas 11 dígitos ou string vazia se inválido
   */
  static normalize(cpf: string): string {
    if (!cpf || typeof cpf !== 'string') {
      return '';
    }
    return cpf.replace(/\D/g, '');
  }

  /**
   * Verifica se o CPF tem todos os dígitos iguais (inválidos)
   * @param cpf - CPF normalizado (11 dígitos)
   * @returns true se todos dígitos são iguais
   */
  static hasRepeatedDigits(cpf: string): boolean {
    return /^(\d)\1{10}$/.test(cpf);
  }

  /**
   * Calcula dígito verificador usando algoritmo oficial
   * @param baseDigits - primeiros 9 ou 10 dígitos
   * @param multiplier - começa com 10 (primeiro dígito) ou 11 (segundo dígito)
   * @returns dígito verificador
   */
  private static calculateCheckDigit(
    baseDigits: string,
    multiplier: number,
  ): number {
    let sum = 0;
    for (let i = 0; i < baseDigits.length; i++) {
      sum += parseInt(baseDigits[i], 10) * (multiplier - i);
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }

  /**
   * Valida CPF usando algoritmo oficial
   * @param cpf - CPF com ou sem formatação
   * @returns true se válido, false caso contrário
   */
  static isValid(cpf: string): boolean {
    const normalized = this.normalize(cpf);

    // Deve ter exatamente 11 dígitos
    if (normalized.length !== 11) {
      return false;
    }

    // Rejeita CPFs com todos os dígitos iguais
    if (this.hasRepeatedDigits(normalized)) {
      return false;
    }

    // Valida primeiro dígito verificador
    const firstCheckDigit = this.calculateCheckDigit(
      normalized.substring(0, 9),
      10,
    );
    if (parseInt(normalized[9], 10) !== firstCheckDigit) {
      return false;
    }

    // Valida segundo dígito verificador
    const secondCheckDigit = this.calculateCheckDigit(
      normalized.substring(0, 10),
      11,
    );
    if (parseInt(normalized[10], 10) !== secondCheckDigit) {
      return false;
    }

    return true;
  }

  /**
   * Valida e normaliza CPF de uma só vez
   * @param cpf - CPF com ou sem formatação
   * @returns objeto com status e CPF normalizado
   */
  static validate(cpf: string): { isValid: boolean; normalized: string } {
    const normalized = this.normalize(cpf);
    return {
      isValid: this.isValid(normalized),
      normalized,
    };
  }
}
