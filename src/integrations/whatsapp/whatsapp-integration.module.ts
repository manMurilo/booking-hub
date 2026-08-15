import { Module } from '@nestjs/common';
import { BaileysConnectionService } from './baileys-connection.service';
import { WhatsAppMessageAdapterService } from './whatsapp-message-adapter.service';

/**
 * WhatsApp Integration Module
 * Gerencia a integração com Baileys como camada de transporte
 *
 * Exporta:
 * - BaileysConnectionService: conexão com WhatsApp
 * - WhatsAppMessageAdapterService: normalização de mensagens
 *
 * Esta é uma integração/infraestrutura, não contém lógica de negócio
 */
@Module({
  providers: [BaileysConnectionService, WhatsAppMessageAdapterService],
  exports: [BaileysConnectionService, WhatsAppMessageAdapterService],
})
export class WhatsAppIntegrationModule {}
