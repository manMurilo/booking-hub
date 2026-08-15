import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TrinksModule } from '../../integrations/trinks/trinks.module';
import { ValidatorsModule } from '../validators/validators.module';
import { ConversationStateModule } from '../conversation-state/conversation-state.module';

/**
 * Módulo de Booking
 * Centraliza queries de agendamento:
 * - Busca de clientes (por telefone ou CPF)
 * - Disponibilidade de agenda
 * - Listagem de planos, serviços, profissionais
 * - Validação de agendamentos
 *
 * Importa:
 * - TrinksModule (integração com API Trinks)
 * - ValidatorsModule (CPF, telefone, nome)
 * - ConversationStateModule (rastreamento de estado)
 */
@Module({
  imports: [TrinksModule, ValidatorsModule, ConversationStateModule],
  providers: [BookingService],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
