import { Controller, Get, Post, Query, Body, HttpCode } from '@nestjs/common';
import { BookingService } from './booking.service';
import {
  FindClienteResponse,
  AvailabilityResponse,
  AvailabilityMultipleDaysResponse,
  ListPlanosResponse,
  ListServicosResponse,
  ListProfissionaisResponse,
  ValidateAppointmentResult,
} from './booking.types';

/**
 * Controller de Booking
 * Endpoints para queries de agendamento:
 * - Busca de clientes
 * - Disponibilidade de agenda
 * - Listagem de planos, serviços, profissionais
 * - Validação de agendamentos
 */
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * POST /booking/agendamento
   * Cria um agendamento validando cliente, serviço, profissional e disponibilidade
   */
  @Post('agendamento')
  @HttpCode(200)
  async createAppointment(
    @Body()
    payload: {
      clienteId: number;
      servicoId: number;
      profissionalId: number;
      dataHora: string;
      valor?: number;
      observacoes?: string;
    },
  ): Promise<any> {
    return this.bookingService.createAppointment(payload);
  }

  /**
   * GET /api/booking/cliente/by-phone
   * Busca cliente pelo telefone
   *
   * @param phone - Telefone do cliente (com ou sem formatação)
   * @returns Cliente encontrado ou mensagem de not found
   */
  @Get('cliente/by-phone')
  async findClienteByPhone(@Query('phone') phone: string): Promise<FindClienteResponse> {
    return this.bookingService.findClienteByPhoneNumber(phone);
  }

  /**
   * GET /api/booking/cliente/by-cpf
   * Busca cliente pelo CPF
   *
   * @param cpf - CPF do cliente (com ou sem formatação)
   * @returns Cliente encontrado ou mensagem de not found
   */
  @Get('cliente/by-cpf')
  async findClienteByCpf(@Query('cpf') cpf: string): Promise<FindClienteResponse> {
    return this.bookingService.findClienteByCpf(cpf);
  }

  /**
   * GET /api/booking/agenda/disponivel
   * Busca disponibilidade para um profissional em um dia específico
   *
   * @param profissionalId - ID do profissional (requerido)
   * @param data - Data em formato YYYY-MM-DD (requerida)
   * @returns Disponibilidade do dia
   */
  @Get('agenda/disponivel')
  async getAvailabilityForDay(
    @Query('profissionalId') profissionalId: string,
    @Query('data') data: string,
  ): Promise<AvailabilityResponse> {
    return this.bookingService.getAvailabilityForDay(parseInt(profissionalId, 10), data);
  }

  /**
   * GET /api/booking/agenda/disponivel/multiplos
   * Busca disponibilidade para múltiplos dias
   *
   * @param profissionalId - ID do profissional (requerido)
   * @param servicoId - ID do serviço (requerido)
   * @param dataInicio - Data início em formato YYYY-MM-DD (requerida)
   * @param dataFim - Data fim em formato YYYY-MM-DD (opcional, default = dataInicio)
   * @returns Disponibilidade para vários dias
   */
  @Get('agenda/disponivel/multiplos')
  async getAvailabilityMultipleDays(
    @Query('profissionalId') profissionalId: string,
    @Query('servicoId') servicoId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim?: string,
  ): Promise<AvailabilityMultipleDaysResponse> {
    return this.bookingService.getAvailabilityMultipleDays(
      parseInt(profissionalId, 10),
      parseInt(servicoId, 10),
      dataInicio,
      dataFim,
    );
  }

  /**
   * GET /api/booking/planos
   * Lista todos os planos disponíveis
   *
   * @returns Lista de planos
   */
  @Get('planos')
  async listPlanos(): Promise<ListPlanosResponse> {
    return this.bookingService.listPlanos();
  }

  /**
   * GET /api/booking/servicos
   * Lista todos os serviços disponíveis
   *
   * @returns Lista de serviços
   */
  @Get('servicos')
  async listServicos(): Promise<ListServicosResponse> {
    return this.bookingService.listServicos();
  }

  /**
   * GET /api/booking/profissionais
   * Lista todos os profissionais disponíveis
   *
   * @returns Lista de profissionais
   */
  @Get('profissionais')
  async listProfissionais(): Promise<ListProfissionaisResponse> {
    return this.bookingService.listProfissionais();
  }

  /**
   * POST /api/booking/validar-agendamento
   * Valida se um agendamento é possível
   *
   * @param payload - { clienteId, servicoId, profissionalId, dataHora }
   * @returns Resultado da validação
   */
  @Post('validar-agendamento')
  @HttpCode(200)
  async validateAppointment(
    @Body()
    payload: {
      clienteId: number;
      servicoId: number;
      profissionalId: number;
      dataHora: string; // YYYY-MM-DD HH:mm
    },
  ): Promise<ValidateAppointmentResult> {
    const { clienteId, servicoId, profissionalId, dataHora } = payload;
    return this.bookingService.validateAppointment(
      clienteId,
      servicoId,
      profissionalId,
      dataHora,
    );
  }
}
