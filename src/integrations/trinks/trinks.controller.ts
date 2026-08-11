import { Controller, Get, Query } from '@nestjs/common';
import { TrinksService } from './trinks.service';
import { TrinksAgendamentosResponse } from './trinks.types';

@Controller('trinks')
export class TrinksController {
  constructor(private readonly trinksService: TrinksService) {}

  @Get('agendamentos')
  async getAgendamentos(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<TrinksAgendamentosResponse> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;

    return this.trinksService.getAgendamentos({
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
    });
  }

}
