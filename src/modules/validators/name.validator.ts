/**
 * Name Validator
 * Valida e normaliza nomes de clientes
 * Regras:
 * - Aceita nome completo ou apenas primeiro nome
 * - Não aceita números
 * - Capitaliza corretamente (primeira letra maiúscula)
 * - Rejeita nomes claramente de zuera/troll
 */

export class NameValidator {
  /**
   * Lista de palavras/padrões comuns em nomes fake/troll
   */
  private static readonly TROLL_PATTERNS = [
    /^(xxx|xp{2,}|kkk|haha|lol|meme)/i,
    /^(admin|root|test|fake|troll|bot|user|asdf|qwerty|123|000)/i,
    /^(b[o0]+t|cr1ng[ae]|d0ub7)[a-z]*/i,
    /^(cocô|coco|pipi|teta|rabo|popo|bunda|cu|pinto|pfff)/i,
    /fuck|shit|damn|asshole/i,
    /^(666|666|1488|88)/i,
  ];

  /**
   * Limpa espaços extras de um texto
   * @param text - Texto a limpar
   * @returns Texto com espaços normalizados
   */
  private static trimSpaces(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Capitaliza a primeira letra de cada palavra
   * @param text - Texto a capitalizar
   * @returns Texto capitalizado
   */
  private static capitalize(text: string): string {
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (word.length === 0) return word;
        // Preserva conectores como "de", "da", "do", etc. em minúscula
        if (
          [
            'de',
            'da',
            'do',
            'di',
            'du',
            'e',
            'é',
            'o',
            'os',
            'a',
            'as',
          ].includes(word)
        ) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  /**
   * Detecta se o nome parece ser fake/troll
   * @param name - Nome a verificar
   * @returns true se parecer fake/troll
   */
  static isTrollName(name: string): boolean {
    const trimmed = name.trim();

    // Muito curto (menos de 2 caracteres)
    if (trimmed.length < 2) {
      return true;
    }

    // Muito longo (mais de 100 caracteres)
    if (trimmed.length > 100) {
      return true;
    }

    // Verifica padrões conhecidos de troll
    for (const pattern of this.TROLL_PATTERNS) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }

    // Repetição excessiva de caracteres
    if (/(.)\1{4,}/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Verifica se o nome contém números
   * @param name - Nome a verificar
   * @returns true se contiver números
   */
  static hasNumbers(name: string): boolean {
    return /\d/.test(name);
  }

  /**
   * Verifica se o nome contém caracteres especiais inválidos
   * @param name - Nome a verificar
   * @returns true se contiver caracteres especiais inválidos
   */
  static hasInvalidCharacters(name: string): boolean {
    // Aceita letras, espaços, hífens, apóstrofes e acentos
    return !/^[\p{L}\s\-']+$/u.test(name);
  }

  /**
   * Valida um nome
   * @param name - Nome a validar
   * @returns Objeto com isValid, normalized, e razão de rejeição se inválido
   */
  static validate(name: string): {
    isValid: boolean;
    normalized: string;
    reason?: string;
  } {
    if (!name || typeof name !== 'string') {
      return { isValid: false, normalized: '', reason: 'Nome vazio' };
    }

    const trimmed = this.trimSpaces(name);

    if (this.hasNumbers(trimmed)) {
      return {
        isValid: false,
        normalized: '',
        reason: 'Nome não pode conter números',
      };
    }

    if (this.hasInvalidCharacters(trimmed)) {
      return {
        isValid: false,
        normalized: '',
        reason: 'Nome contém caracteres inválidos',
      };
    }

    if (this.isTrollName(trimmed)) {
      return {
        isValid: false,
        normalized: '',
        reason: 'Nome parece ser inválido ou fake',
      };
    }

    const normalized = this.capitalize(trimmed);

    return {
      isValid: true,
      normalized,
    };
  }

  /**
   * Extrai o primeiro nome de um nome completo
   * @param fullName - Nome completo
   * @returns Apenas o primeiro nome
   */
  static getFirstName(fullName: string): string {
    const trimmed = this.trimSpaces(fullName);
    const parts = trimmed.split(' ');
    return parts[0] || '';
  }

  /**
   * Valida se o nome é válido para armazenamento
   * Retorna true se passou em todas as validações
   * @param name - Nome a verificar
   * @returns true se válido
   */
  static isValid(name: string): boolean {
    return this.validate(name).isValid;
  }
}
