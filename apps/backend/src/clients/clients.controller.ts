import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(private clients: ClientsService) {}

  @Get()
  list(@Req() req: any, @Query('q') q?: string) {
    return this.clients.list(req.user.activeOrganizationId, q);
  }

  @Get(':id/comments')
  listComments(@Req() req: any, @Param('id') id: string) {
    return this.clients.listComments(req.user.activeOrganizationId, id);
  }

  @Post(':id/comments')
  addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.clients.addComment(req.user.activeOrganizationId, id, req.user.id, body.body);
  }

  @Post()
  create(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      phone: string;
      note?: string | null;
      statusId?: string | null;
      bank?: string | null;
      assistantName?: string | null;
      callSummary?: string | null;
      callStartedAt?: string | null;
      customData?: Record<string, unknown> | null;
    },
  ) {
    return this.clients.create(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      note?: string | null;
      statusId?: string | null;
      bank?: string | null;
      assistantName?: string | null;
      callSummary?: string | null;
      callStartedAt?: string | null;
      customData?: Record<string, unknown> | null;
    },
  ) {
    return this.clients.update(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.clients.remove(req.user.activeOrganizationId, id);
  }
}
