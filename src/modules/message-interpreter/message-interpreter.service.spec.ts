import { DeterministicMessageInterpreter } from './message-interpreter.service';
import { ConversationIntent } from '../conversation-state/conversation-flow.types';

describe('DeterministicMessageInterpreter', () => {
  it.each([
    'fazer um agendamento',
    'quero marcar um horário',
    'qeuria cortar o cabelo',
  ])('recognizes booking intent for "%s"', async (message) => {
    const result = await new DeterministicMessageInterpreter().interpret(message);

    expect(result.intent).toBe(ConversationIntent.BOOKING);
  });

  it('matches the explicit examples from the message interpretation contract', async () => {
    const cases = [
      {
        message: 'oi',
        intent: ConversationIntent.UNKNOWN,
        service: null,
        normalizedText: 'oi',
        confidence: 0.95,
      },
      {
        message: 'qeuria cortar o cabelo',
        intent: ConversationIntent.BOOKING,
        service: 'corte de cabelo',
        normalizedText: 'queria cortar o cabelo',
        confidence: 0.93,
      },
      {
        message: 'fazer um agendamento',
        intent: ConversationIntent.BOOKING,
        service: null,
        normalizedText: 'fazer um agendamento',
        confidence: 0.96,
      },
      {
        message: 'quero marcar um horário amanhã de manhã',
        intent: ConversationIntent.BOOKING,
        service: null,
        date: 'amanhã',
        normalizedText: 'quero marcar um horario amanha de manha',
        confidence: 0.94,
      },
      {
        message: 'quanto custa o corte?',
        intent: ConversationIntent.INQUIRY,
        service: 'corte',
        normalizedText: 'quanto custa o corte',
        confidence: 0.91,
      },
    ];

    for (const testCase of cases) {
      const result = await new DeterministicMessageInterpreter().interpret(
        testCase.message,
      );

      expect(result.intent).toBe(testCase.intent);
      expect(result.service).toBe(testCase.service);
      if (testCase.date) {
        expect(result.date).toBe(testCase.date);
      }
      expect(result.normalizedText).toBe(testCase.normalizedText);
      expect(result.confidence).toBeCloseTo(testCase.confidence, 2);
    }
  });

  it('uses the conversation context for follow-up booking details', async () => {
    const result = await new DeterministicMessageInterpreter().interpret(
      'com o João',
      ({
        conversation: {
          booking: { serviceName: 'cortar o cabelo' },
        },
      }) as any,
    );

    expect(result.intent).toBe(ConversationIntent.BOOKING);
    expect(result.professional).toBe('João');
  });
});
