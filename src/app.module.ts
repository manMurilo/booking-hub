import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { TrinksModule } from './integrations/trinks/trinks.module';
import { ValidatorsModule } from './modules/validators/validators.module';
import { ConversationStateModule } from './modules/conversation-state/conversation-state.module';
import { BookingModule } from './modules/booking/booking.module';
import { AIModule } from './ai/ai.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    TrinksModule,
    ValidatorsModule,
    ConversationStateModule,
    BookingModule,
    AIModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
