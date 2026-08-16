jest.mock('../../integrations/whatsapp/baileys-connection.service', () => ({
  BaileysConnectionService: class BaileysConnectionService {},
}));

import { WhatsAppService } from './whatsapp.service';
import { ConversationFlowOrchestrator } from '../conversation-state/conversation-flow.orchestrator';
import { ConversationStateService } from '../conversation-state/conversation-state.service';
import { TrinksAvailabilityExecutor } from '../conversation-state/trinks-availability-executor.service';
import { DeterministicMessageInterpreter } from '../message-interpreter/message-interpreter.service';
import { MessageContextUpdaterService } from '../message-interpreter/message-context-updater.service';
import { PendingAction } from '../conversation-state/conversation-flow.types';

describe('WhatsAppService booking flow', () => {
  it('completes identification, registration, availability, confirmation and booking', async () => {
    const conversationStateService = new ConversationStateService();
    const bookingService = {
      findClienteByPhoneNumber: jest.fn().mockResolvedValue({
        found: false,
        message: 'Cliente não encontrado',
      }),
      resolveServiceByName: jest.fn().mockResolvedValue({
        servicoId: 20,
        nome: 'Corte',
        descricao: '',
        duracao: 40,
        ativo: true,
      }),
      resolveProfessionalByName: jest.fn(),
      registerCliente: jest.fn().mockResolvedValue({
        clienteId: 10,
        nome: 'Maria da Silva',
        primeiroNome: 'Maria',
        cpf: '52998224725',
        telefone: '5511999999999',
        ativo: true,
      }),
      createAppointment: jest.fn().mockResolvedValue({
        created: true,
        agendamento: { id: 123 },
      }),
    };
    const agendamentosService = {
      getDisponibilidade: jest.fn().mockResolvedValue({
        data: [
          {
            id: 99,
            nome: 'Profissional disponível',
            horariosVagos: ['09:00'],
            intervalosVagos: [],
          },
        ],
      }),
    };
    const baileysConnectionService = {
      onMessage: jest.fn(),
      onConnectionStateChange: jest.fn(),
      sendMessage: jest.fn(),
    };
    const messageAdapterService = {
      normalizeIncomingMessage: jest.fn(),
      prepareOutgoingMessage: jest.fn(),
    };

    const service = new WhatsAppService(
      {} as any,
      bookingService as any,
      conversationStateService,
      new ConversationFlowOrchestrator(),
      new TrinksAvailabilityExecutor(agendamentosService as any),
      baileysConnectionService as any,
      messageAdapterService as any,
      new DeterministicMessageInterpreter(),
      new MessageContextUpdaterService(),
    );

    const processTurn = (service as any).processTurn.bind(service) as (
      conversationId: string,
      batch: Array<{ from: string; text: string; timestamp: number }>,
    ) => Promise<any>;

    const firstMessage = {
      from: '5511999999999',
      text: 'quero cortar o cabelo amanhã às 9',
      timestamp: Date.now(),
    };
    const conversation = conversationStateService.getOrCreateConversation(
      firstMessage.from,
    );

    const identification = await processTurn(conversation.conversationId, [
      firstMessage,
    ]);
    expect(identification.aiResponse).toContain('Você já é cliente');

    const registration = await processTurn(conversation.conversationId, [
      { ...firstMessage, text: 'não', timestamp: Date.now() },
    ]);
    expect(registration.aiResponse).toContain('nome completo');

    const availability = await processTurn(conversation.conversationId, [
      {
        ...firstMessage,
        text: 'Maria da Silva CPF 529.982.247-25',
        timestamp: Date.now(),
      },
    ]);
    expect(availability.aiResponse).toContain('está disponível');
    expect(availability.metadata.flowAction).toBe(
      PendingAction.EXECUTE_TRINKS_ACTION,
    );

    const completed = await processTurn(conversation.conversationId, [
      { ...firstMessage, text: 'sim', timestamp: Date.now() },
    ]);
    expect(completed.aiResponse).toContain('Agendamento confirmado');
    expect(bookingService.registerCliente).toHaveBeenCalledWith({
      nome: 'maria da silva',
      cpf: '529.982.247-25',
      telefone: '5511999999999',
    });
    expect(bookingService.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 10,
        servicoId: 20,
        dataHora: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T09:00:00$/),
      }),
    );
  });
});
