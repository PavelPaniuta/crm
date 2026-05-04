import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FieldType, Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientOrgSettingsService } from './client-org-settings.service';

@Controller('client-field-definitions')
@UseGuards(AuthGuard, RolesGuard)
export class ClientFieldDefinitionsController {
  constructor(private settings: ClientOrgSettingsService) {}

  @Get()
  list(@Req() req: any) {
    return this.settings.listFieldDefinitions(req.user.activeOrganizationId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Req() req: any,
    @Body()
    body: {
      key: string;
      label: string;
      type?: FieldType;
      required?: boolean;
      order?: number;
      options?: string | null;
    },
  ) {
    return this.settings.createFieldDefinition(req.user.activeOrganizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      label?: string;
      type?: FieldType;
      required?: boolean;
      order?: number;
      options?: string | null;
    },
  ) {
    return this.settings.updateFieldDefinition(req.user.activeOrganizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.settings.deleteFieldDefinition(req.user.activeOrganizationId, id);
  }
}
