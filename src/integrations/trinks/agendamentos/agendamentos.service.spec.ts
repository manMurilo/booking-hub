import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service';
import { TrinksCreateAgendamentoPayload } from './agendamentos.types';

describe('AgendamentosService', () => {
  const trinksService = {
    getApiConfig: jest.fn(),
    buildApiUrl: jest.fn(),
    normalizeTrinksDate: jest.fn(),
    normalizeTrinksDatePath: jest.fn(),
  };

  const clientesService = {
    getClientePorId: jest.fn(),
  };

  const profissionaisService = {
    getProfissionais: jest.fn(),
    getServicosDoProfissional: jest.fn(),
  };

  const servicosService = {
    getServicos: jest.fn(),
  };

  const service = new AgendamentosService(
    trinksService as any,
    clientesService as any,
    profissionaisService as any,
    servicosService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an appointment when duration is invalid', async () => {
    const payload: TrinksCreateAgendamentoPayload = {
      servicoId: 10,
      clienteId: 20,
      dataHoraInicio: new Date(Date.now() + 60_000).toISOString(),
      duracaoEmMinutos: 0,
      valor: 100,
      confirmado: false,
    };

    await expect(
      service.validateLocalAgendamentoRules(payload),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an appointment when the professional is not available for the requested slot', async () => {
    clientesService.getClientePorId.mockResolvedValue({ id: 20 });
    servicosService.getServicos.mockResolvedValue({
      data: [{ id: 10, nome: 'Corte' }],
    });
    profissionaisService.getProfissionais.mockResolvedValue({
      data: [{ id: 30, nome: 'Maria' }],
    });
    profissionaisService.getServicosDoProfissional.mockResolvedValue([
      { id: 10 },
    ]);

    const agendaSpy = jest.spyOn(service, 'getAgenda').mockResolvedValue({
      data: [
        {
          id: 30,
          nome: 'Maria',
          horariosVagos: ['09:00-09:30'],
          intervalosVagos: [],
        },
      ],
      page: 1,
      pageSize: 20,
      totalPages: 1,
      totalRecords: 1,
    });

    const payload: TrinksCreateAgendamentoPayload = {
      servicoId: 10,
      clienteId: 20,
      profissionalId: 30,
      dataHoraInicio: new Date('2030-01-02T10:45:00').toISOString(),
      duracaoEmMinutos: 60,
      valor: 100,
      confirmado: false,
    };

    await expect(
      service.validateLocalAgendamentoRules(payload),
    ).rejects.toThrow(ConflictException);

    expect(agendaSpy).toHaveBeenCalled();
  });

  it('rejects when client does not exist in Trinks', async () => {
    clientesService.getClientePorId.mockRejectedValue(
      new HttpException('not found', HttpStatus.NOT_FOUND),
    );

    const payload: TrinksCreateAgendamentoPayload = {
      servicoId: 10,
      clienteId: 999,
      dataHoraInicio: new Date(Date.now() + 60_000).toISOString(),
      duracaoEmMinutos: 30,
      valor: 80,
      confirmado: false,
    };

    await expect(
      service.validateLocalAgendamentoRules(payload),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
