import { Module } from '@nestjs/common';
import { CpfValidator } from './cpf.validator';
import { PhoneValidator } from './phone.validator';
import { NameValidator } from './name.validator';

/**
 * Módulo de Validadores
 * Exporta validadores para uso em toda a aplicação
 * 
 * Validadores disponíveis:
 * - CpfValidator: valida CPF com algoritmo oficial
 * - PhoneValidator: valida telefones brasileiros
 * - NameValidator: valida e normaliza nomes de clientes
 */
@Module({
  providers: [CpfValidator, PhoneValidator, NameValidator],
  exports: [CpfValidator, PhoneValidator, NameValidator],
})
export class ValidatorsModule {}
