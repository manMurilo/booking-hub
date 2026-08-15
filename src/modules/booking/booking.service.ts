import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ClientesService } from '../../integrations/trinks/clientes/clientes.service';
import { AgendamentosService } from '../../integrations/trinks/agendamentos/agendamentos.service';
import { PlanosService } from '../../integrations/trinks/planos/planos.service';
import { ServicosService } from '../../integrations/trinks/servicos/servicos.service';
import { ProfissionaisService } from '../../integrations/trinks/profissionais/profissionais.service';
import { CpfValidator } from '../validators/cpf.validator';
import { PhoneValidator } from '../validators/phone.validator';
import { ConversationStateService } from '../conversation-state/conversation-state.service';
import {
  ClienteSearchResult,
  FindClienteResponse,
  AvailabilityResponse,
  AvailabilityMultipleDaysResponse,
  PlanoResponse,
  ListPlanosResponse,
  ServicoResponse,
  ListServicosResponse,
  ProfissionalResponse,
  ListProfissionaisResponse,
  ValidateAppointmentResult,
} from './booking.types';

/**
 * Serviço de Booking
 * Centraliza todas as queries para agendamento:
 * - Busca de clientes
 * - Disponibilidade de agenda
 * - Planos e serviços
 * - Validações
 */
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly clientesService: ClientesService,
    private readonly agendamentosService: AgendamentosService,
    private readonly planosService: PlanosService,
    private readonly servicosService: ServicosService,
    private readonly profissionaisService: ProfissionaisService,
    private readonly conversationStateService: ConversationStateService,
  ) {}

  /**
   * Busca cliente pelo telefone
   * @param telefone - Telefone normalizado (13 dígitos com DDI)
   * @returns Resultado da busca
   */
  async findClienteByPhoneNumber(
    telefone: string,
  ): Promise<FindClienteResponse> {
    // Valida telefone
    const { isValid, normalized } = PhoneValidator.validate(telefone);

    if (!isValid) {
      return {
        found: false,
        message: 'Telefone inválido',
      };
    }

    try {
      // Busca na API Trinks usando método getClientes com filtro de telefone
      const response = await this.clientesService.getClientes({
        telefone: normalized,
      });

      if (!response?.data || response.data.length === 0) {
        return {
          found: false,
          message: 'Cliente não encontrado com este telefone',
        };
      }

      // Retorna o primeiro cliente encontrado
      const cliente = response.data[0];
      const resultado: ClienteSearchResult = {
        clienteId: cliente.id,
        nome: cliente.nome,
        primeiroNome: cliente.nome.split(' ')[0],
        cpf: cliente.cpf || '',
        telefone: normalized,
        ativo: cliente.ativo !== false,
      };

      return {
        found: true,
        cliente: resultado,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao buscar cliente por telefone: ${message}`);
      throw new BadRequestException('Erro ao buscar cliente');
    }
  }

  /**
   * Busca cliente pelo CPF
   * @param cpf - CPF com ou sem formatação
   * @returns Resultado da busca
   */
  async findClienteByCpf(cpf: string): Promise<FindClienteResponse> {
    const { isValid, normalized } = CpfValidator.validate(cpf);

    if (!isValid) {
      return {
        found: false,
        message: 'CPF inválido',
      };
    }

    try {
      const response = await this.clientesService.getClientes({
        cpf: normalized,
      });

      if (!response?.data || response.data.length === 0) {
        return {
          found: false,
          message: 'Cliente não encontrado com este CPF',
        };
      }

      const cliente = response.data[0];
      return {
        found: true,
        cliente: {
          clienteId: cliente.id,
          nome: cliente.nome,
          primeiroNome: cliente.nome.split(' ')[0],
          cpf: normalized,
          telefone: (cliente.telefone as string) || '',
          ativo: cliente.ativo !== false,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao buscar cliente por CPF: ${message}`);
      throw new BadRequestException('Erro ao buscar cliente');
    }
  }

  /**
   * Busca agenda disponível para um profissional em um dia
   * @param profissionalId - ID do profissional
   * @param data - Data (YYYY-MM-DD)
   * @returns Disponibilidade do dia
   */
  async getAvailabilityForDay(
    profissionalId: number,
    data: string,
  ): Promise<AvailabilityResponse> {
    try {
      const agenda = await this.agendamentosService.getAgenda({
        profissionalId,
        data,
      });

      if (!agenda?.data || agenda.data.length === 0) {
        return {
          data,
          dataFormatada: this.formatData(data),
          slots: [],
          totalDisponivel: 0,
        };
      }

      const profissionalAgenda = agenda.data[0];
      const slots = profissionalAgenda.horariosVagos.map((horario: string) => ({
        horario,
        disponivel: true,
      }));

      return {
        data,
        dataFormatada: this.formatData(data),
        slots,
        totalDisponivel: slots.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao buscar agenda para ${data}: ${message}`);
      throw new BadRequestException('Erro ao buscar disponibilidade');
    }
  }

  /**
   * Busca agenda disponível para múltiplos dias
   * @param profissionalId - ID do profissional
   * @param servicoId - ID do serviço
   * @param dataInicio - Data início (YYYY-MM-DD)
   * @param dataFim - Data fim (YYYY-MM-DD), se não informada usa apenas dataInicio
   * @returns Disponibilidade para vários dias
   */
  async getAvailabilityMultipleDays(
    profissionalId: number,
    servicoId: number,
    dataInicio: string,
    dataFim?: string,
  ): Promise<AvailabilityMultipleDaysResponse> {
    try {
      const profissionaisResponse =
        await this.profissionaisService.getProfissionais({});
      const profissional = profissionaisResponse?.data?.find(
        (p: any) => p.id === profissionalId,
      );

      if (!profissional) {
        throw new NotFoundException('Profissional não encontrado');
      }

      const servicosResponse = await this.servicosService.getServicos({});
      const servico = servicosResponse?.data?.find(
        (s: any) => s.id === servicoId,
      );

      if (!servico) {
        throw new NotFoundException('Serviço não encontrado');
      }

      const start = new Date(`${dataInicio}T00:00:00`);
      const end = dataFim ? new Date(`${dataFim}T00:00:00`) : start;

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new BadRequestException('Datas de disponibilidade inválidas');
      }

      if (start > end) {
        throw new BadRequestException(
          'dataInicio não pode ser maior que dataFim',
        );
      }

      const dias: AvailabilityResponse[] = [];
      const cursor = new Date(start);

      while (cursor <= end) {
        const dateKey = this.toDateKey(cursor);
        dias.push(await this.getAvailabilityForDay(profissionalId, dateKey));
        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        profissionalId,
        profissionalNome: profissional.nome,
        servicoId,
        servicoNome: servico.nome,
        dias,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao buscar agenda múltiplos dias: ${message}`);
      throw new BadRequestException('Erro ao buscar disponibilidade');
    }
  }

  /**
   * Lista todos os planos disponíveis
   * @returns Lista de planos
   */
  async listPlanos(): Promise<ListPlanosResponse> {
    try {
      const response = await this.planosService.getPlanos({});

      const planosFormatados: PlanoResponse[] = (response?.data || []).map(
        (plano: any) => ({
          planoId: plano.id,
          nome: plano.nome,
          descricao: plano.descricao,
          ativo: plano.ativo !== false,
          servicos: plano.beneficios?.map((b: any) => ({
            servicoId: b.beneficio?.id,
            servicoNome: b.beneficio?.nome,
          })),
        }),
      );

      return {
        planos: planosFormatados,
        total: planosFormatados.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao listar planos: ${message}`);
      throw new BadRequestException('Erro ao listar planos');
    }
  }

  /**
   * Lista todos os serviços disponíveis
   * @returns Lista de serviços
   */
  async listServicos(): Promise<ListServicosResponse> {
    try {
      const response = await this.servicosService.getServicos({});

      const servicosFormatados: ServicoResponse[] = (response?.data || []).map(
        (servico: any) => ({
          servicoId: servico.id,
          nome: servico.nome,
          descricao: servico.descricao,
          duracao: servico.duracao || 0,
          ativo: servico.ativo !== false,
        }),
      );

      return {
        servicos: servicosFormatados,
        total: servicosFormatados.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao listar serviços: ${message}`);
      throw new BadRequestException('Erro ao listar serviços');
    }
  }

  /**
   * Lista todos os profissionais disponíveis
   * @returns Lista de profissionais
   */
  async listProfissionais(): Promise<ListProfissionaisResponse> {
    try {
      const response = await this.profissionaisService.getProfissionais({});

      const profissionaisFormatados: ProfissionalResponse[] = (
        response?.data || []
      ).map((prof: any) => ({
        profissionalId: prof.id,
        nome: prof.nome,
        apelido: prof.apelido,
        ativo: prof.ativo !== false,
        especialidades: prof.especialidades || [],
      }));

      return {
        profissionais: profissionaisFormatados,
        total: profissionaisFormatados.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao listar profissionais: ${message}`);
      throw new BadRequestException('Erro ao listar profissionais');
    }
  }

  /**
   * Valida se um agendamento é possível
   * Verifica:
   * - Cliente existe
   * - Serviço existe
   * - Profissional existe
   * - Horário está disponível
   * - Cliente não tem agendamento conflitante
   *
   * @param clienteId - ID do cliente
   * @param servicoId - ID do serviço
   * @param profissionalId - ID do profissional
   * @param dataHora - Data e hora (YYYY-MM-DD HH:mm)
   * @returns Resultado da validação
   */
  async validateAppointment(
    clienteId: number,
    servicoId: number,
    profissionalId: number,
    dataHora: string,
  ): Promise<ValidateAppointmentResult> {
    try {
      const servicos = await this.servicosService.getServicos({});
      const servico = servicos?.data?.find((s: any) => s.id === servicoId);
      if (!servico) {
        return {
          valid: false,
          reason: 'Serviço não encontrado',
        };
      }

      const cliente = await this.clientesService.getClientePorId(clienteId);
      if (!cliente) {
        return {
          valid: false,
          reason: 'Cliente não encontrado',
        };
      }

      const profissionais = await this.profissionaisService.getProfissionais(
        {},
      );
      const profissional = profissionais?.data?.find(
        (p: any) => p.id === profissionalId,
      );
      if (!profissional) {
        return {
          valid: false,
          reason: 'Profissional não encontrado',
        };
      }

      const duracaoEmMinutos = Number(
        servico.duracaoEmMinutos ?? servico.duracao ?? 0,
      );
      const valor = Number(servico.preco ?? 0);
      const requestPayload = {
        servicoId,
        clienteId,
        profissionalId,
        dataHoraInicio: dataHora,
        duracaoEmMinutos,
        valor,
        observacoes: null,
        confirmado: false,
      };

      await this.agendamentosService.validateLocalAgendamentoRules(
        requestPayload,
      );

      return {
        valid: true,
        clienteId,
        servicoId,
        profissionalId,
        dataHora,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        return {
          valid: false,
          reason: error.message,
          clienteId,
          servicoId,
          profissionalId,
          dataHora,
          conflitos: [error.message],
        };
      }

      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao validar agendamento: ${message}`);
      throw new BadRequestException('Erro ao validar agendamento');
    }
  }

  async createAppointment(payload: {
    clienteId: number;
    servicoId: number;
    profissionalId: number;
    dataHora: string;
    valor?: number;
    observacoes?: string;
  }): Promise<any> {
    const {
      clienteId,
      servicoId,
      profissionalId,
      dataHora,
      valor,
      observacoes,
    } = payload;

    const servicos = await this.servicosService.getServicos({});
    const servico = servicos?.data?.find((item: any) => item.id === servicoId);
    if (!servico) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const cliente = await this.clientesService.getClientePorId(clienteId);
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const profissionais = await this.profissionaisService.getProfissionais({});
    const profissional = profissionais?.data?.find(
      (item: any) => item.id === profissionalId,
    );
    if (!profissional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const duracaoEmMinutos = Number(
      servico.duracaoEmMinutos ?? servico.duracao ?? 0,
    );
    const requestPayload = {
      servicoId,
      clienteId,
      profissionalId,
      dataHoraInicio: dataHora,
      duracaoEmMinutos,
      valor: valor ?? Number(servico.preco ?? 0),
      observacoes: observacoes ?? null,
      confirmado: false,
    };

    await this.agendamentosService.validateLocalAgendamentoRules(
      requestPayload,
    );

    const preparedRequest =
      this.agendamentosService.prepareCreateAgendamentoRequest(requestPayload);
    const created =
      await this.agendamentosService.createAgendamento(preparedRequest);

    return {
      created: true,
      agendamento: created,
      clienteId,
      servicoId,
      profissionalId,
      dataHoraInicio: dataHora,
      valor: requestPayload.valor,
      observacoes: requestPayload.observacoes,
    };
  }

  /**
   * Formata data do padrão ISO para legível em português
   * @param dataIso - Data em formato YYYY-MM-DD
   * @returns Data formatada (ex: "segunda-feira, 15 de agosto de 2026")
   */
  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatData(dataIso: string): string {
    const diasSemana = [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ];
    const meses = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];

    const date = new Date(`${dataIso}T00:00:00`);
    const diaSemana = diasSemana[date.getUTCDay()];
    const dia = date.getUTCDate();
    const mes = meses[date.getUTCMonth()];
    const ano = date.getUTCFullYear();

    return `${diaSemana}, ${dia} de ${mes} de ${ano}`;
  }
}
