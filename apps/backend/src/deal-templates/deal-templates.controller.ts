import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DealTemplatesService } from './deal-templates.service';

@Controller('deal-templates')
@UseGuards(AuthGuard)
export class DealTemplatesController {
  constructor(private svc: DealTemplatesService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.activeOrganizationId);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.get(req.user.activeOrganizationId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.svc.create(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.svc.delete(req.user.activeOrganizationId, id);
  }
}
