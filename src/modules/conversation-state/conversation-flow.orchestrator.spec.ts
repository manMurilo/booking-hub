import { ConversationFlowOrchestrator } from './conversation-flow.orchestrator';
import {
  ConversationContext,
  ConversationIntent,
  ConversationStep,
  PendingAction,
} from './conversation-flow.types';

describe('ConversationFlowOrchestrator', () => {
  const orchestrator = new ConversationFlowOrchestrator();

  const createContext = (
    overrides: Partial<ConversationContext> = {},
  ): ConversationContext => ({
    conversationId: 'conversation-1',
    phoneNumber: '5511999999999',
    intent: ConversationIntent.BOOKING,
    step: ConversationStep.INITIAL,
    pendingAction: PendingAction.NONE,
    client: {
      identified: true,
      id: 10,
      name: 'Maria da Silva',
      firstName: 'Maria',
      phone: '5511999999999',
      foundInDatabase: true,
    },
    booking: {
      serviceId: 20,
      serviceName: 'Corte',
      appointmentDate: new Date('2026-08-16T00:00:00'),
      appointmentDateString: 'amanhã',
      appointmentTime: '09:00',
    },
    createdAt: new Date('2026-08-15T00:00:00'),
    lastMessageAt: new Date('2026-08-15T00:00:00'),
    ...overrides,
  });

  it('requests client lookup in Trinks when booking starts without identified client', () => {
    const decision = orchestrator.determineNextStep(
      createContext({
        step: ConversationStep.INITIAL,
        client: { identified: false, phone: '5511999999999' },
        booking: undefined,
      }),
    );

    expect(decision.nextStep).toBe(ConversationStep.CLIENT_IDENTIFICATION);
    expect(decision.action).toBe(PendingAction.CONSULT_TRINKS);
    expect(decision.trinksOperation).toEqual({
      operation: 'GET_CLIENT',
      params: { phone: '5511999999999' },
    });
  });

  it('asks for the missing name and CPF during new client registration', () => {
    const nameDecision = orchestrator.determineNextStep(
      createContext({
        step: ConversationStep.CLIENT_REGISTRATION,
        client: {
          identified: false,
          phone: '5511999999999',
          isNewClient: true,
          waitingForRegistration: true,
        },
        booking: undefined,
      }),
    );

    expect(nameDecision.action).toBe(PendingAction.ASK_USER);
    expect(nameDecision.messageToUser).toContain('nome completo');

    const cpfDecision = orchestrator.determineNextStep(
      createContext({
        step: ConversationStep.CLIENT_REGISTRATION,
        client: {
          identified: false,
          phone: '5511999999999',
          name: 'Maria da Silva',
          isNewClient: true,
          waitingForRegistration: true,
        },
        booking: undefined,
      }),
    );

    expect(cpfDecision.action).toBe(PendingAction.ASK_USER);
    expect(cpfDecision.messageToUser).toContain('CPF');
  });

  it('emits CREATE_CLIENT after collecting name and CPF', () => {
    const decision = orchestrator.determineNextStep(
      createContext({
        step: ConversationStep.CLIENT_REGISTRATION,
        client: {
          identified: false,
          phone: '5511999999999',
          name: 'Maria da Silva',
          cpf: '52998224725',
          isNewClient: true,
          waitingForRegistration: true,
        },
        booking: undefined,
      }),
    );

    expect(decision.action).toBe(PendingAction.EXECUTE_TRINKS_ACTION);
    expect(decision.trinksOperation).toEqual({
      operation: 'CREATE_CLIENT',
      params: {
        name: 'Maria da Silva',
        cpf: '52998224725',
        phone: '5511999999999',
      },
    });
  });

  it('emits CREATE_BOOKING only after explicit confirmation', () => {
    const decision = orchestrator.determineNextStep(
      createContext({
        step: ConversationStep.BOOKING_CONFIRMATION,
        booking: {
          serviceId: 20,
          serviceName: 'Corte',
          appointmentDate: new Date('2026-08-16T00:00:00'),
          appointmentDateString: 'amanhã',
          appointmentTime: '09:00',
          isConfirmed: true,
        },
      }),
    );

    expect(decision.action).toBe(PendingAction.EXECUTE_TRINKS_ACTION);
    expect(decision.trinksOperation?.operation).toBe('CREATE_BOOKING');
  });
});
