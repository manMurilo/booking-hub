import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
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
  async findClienteByPhoneNumber(telefone: string): Promise<FindClienteResponse> {
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
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
      const profissionaisResponse = await this.profissionaisService.getProfissionais({});
      const profissional = profissionaisResponse?.data?.find(
        (p: any) => p.id === profissionalId,
      );

      if (!profissional) {
        throw new NotFoundException('Profissional não encontrado');
      }

      const servicosResponse = await this.servicosService.getServicos({});
      const servico = servicosResponse?.data?.find((s: any) => s.id === servicoId);

      if (!servico) {
        throw new NotFoundException('Serviço não encontrado');
      }

      const availabilityDay = await this.getAvailabilityForDay(
        profissionalId,
        dataInicio,
      );

      return {
        profissionalId,
        profissionalNome: profissional.nome,
        servicoId,
        servicoNome: servico.nome,
        dias: [availabilityDay],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
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
    const conflitos: string[] = [];

    try {
      // Valida cliente
      const cliente = await this.clientesService.getClientePorId(clienteId);
      if (!cliente) {
        return {
          valid: false,
          reason: 'Cliente não encontrado',
        };
      }

      // Valida serviço
      const servicos = await this.servicosService.getServicos({});
      const servico = servicos?.data?.find((s: any) => s.id === servicoId);
      if (!servico) {
        return {
          valid: false,
          reason: 'Serviço não encontrado',
        };
      }

      // Valida profissional
      const profissionais = await this.profissionaisService.getProfissionais({});
      const profissional = profissionais?.data?.find((p: any) => p.id === profissionalId);
      if (!profissional) {
        return {
          valid: false,
          reason: 'Profissional não encontrado',
        };
      }

      // Extrai data do dataHora (formato: YYYY-MM-DD HH:mm)
      const [data] = dataHora.split(' ');

      // Verifica disponibilidade de horário
      const availability = await this.getAvailabilityForDay(profissionalId, data);
      const [, horario] = dataHora.split(' ');
      const slotDisponivel = availability.slots.find((s) => s.horario === horario);

      if (!slotDisponivel || !slotDisponivel.disponivel) {
        conflitos.push('Horário não está disponível');
      }

      // Verifica se cliente tem agendamento futuro (não pode fazer novo sem cancelar)
      const agendamentosFuturos = await this.agendamentosService.getAgendamentos({
        clienteId,
      });
      if (agendamentosFuturos?.data && agendamentosFuturos.data.length > 0) {
        const proximoAgendamento = agendamentosFuturos.data[0] as any;
        conflitos.push(
          `Cliente já tem agendamento em ${proximoAgendamento.dataHora}`,
        );
      }

      // Se tem conflitos, retorna inválido
      if (conflitos.length > 0) {
        return {
          valid: false,
          reason: conflitos[0],
          clienteId,
          servicoId,
          profissionalId,
          dataHora,
          conflitos,
        };
      }

      // Tudo validado, retorna sucesso
      return {
        valid: true,
        clienteId,
        servicoId,
        profissionalId,
        dataHora,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro ao validar agendamento: ${message}`);
      throw new BadRequestException('Erro ao validar agendamento');
    }
  }

  /**
   * Formata data do padrão ISO para legível em português
   * @param dataIso - Data em formato YYYY-MM-DD
   * @returns Data formatada (ex: "segunda-feira, 15 de agosto de 2026")
   */
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
