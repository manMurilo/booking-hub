import { MessageContextUpdaterService } from './message-context-updater.service';
import {
  ConversationContext,
  ConversationIntent,
  ConversationStep,
  PendingAction,
} from '../conversation-state/conversation-flow.types';

describe('MessageContextUpdaterService', () => {
  const updater = new MessageContextUpdaterService();

  const createContext = (): ConversationContext => ({
    conversationId: 'conversation-1',
    phoneNumber: '5511999999999',
    intent: ConversationIntent.BOOKING,
    step: ConversationStep.CLIENT_REGISTRATION,
    pendingAction: PendingAction.ASK_USER,
    client: {
      identified: false,
      phone: '5511999999999',
      isNewClient: true,
      waitingForRegistration: true,
    },
    booking: {
      serviceName: 'Corte',
    },
    createdAt: new Date(),
    lastMessageAt: new Date(),
  });

  it('merges customer data without dropping booking context', () => {
    const result = updater.updateContextFromStructuredMessage(createContext(), {
      intent: ConversationIntent.BOOKING,
      service: null,
      professional: null,
      date: null,
      time: null,
      period: null,
      customer: {
        name: 'Maria da Silva',
        cpf: '52998224725',
        phone: null,
      },
      customerExists: false,
      confirmation: null,
      cancellation: false,
      rawText: 'Maria da Silva CPF 52998224725',
      normalizedText: 'maria da silva cpf 52998224725',
      missingFields: [],
      confidence: 0.99,
    });

    expect(result.client.name).toBe('Maria da Silva');
    expect(result.client.cpf).toBe('52998224725');
    expect(result.client.isNewClient).toBe(true);
    expect(result.booking?.serviceName).toBe('Corte');
  });

  it('converts relative dates into valid Date values', () => {
    const result = updater.updateContextFromStructuredMessage(createContext(), {
      intent: ConversationIntent.BOOKING,
      service: 'Corte',
      professional: null,
      date: 'amanhã',
      time: '09:00',
      period: null,
      customer: null,
      customerExists: null,
      confirmation: null,
      cancellation: false,
      rawText: 'corte amanhã às 9',
      normalizedText: 'corte amanha as 9',
      missingFields: [],
      confidence: 0.99,
    });

    expect(result.booking?.appointmentDate).toBeInstanceOf(Date);
    expect(Number.isNaN(result.booking?.appointmentDate?.getTime())).toBe(
      false,
    );
    expect(result.booking?.appointmentTime).toBe('09:00');
  });
});
