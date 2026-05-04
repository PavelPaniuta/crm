import { Module } from '@nestjs/common';
import { ClientFieldDefinitionsController } from './client-field-definitions.controller';
import { ClientOrgSettingsService } from './client-org-settings.service';
import { ClientStatusesController } from './client-statuses.controller';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController, ClientStatusesController, ClientFieldDefinitionsController],
  providers: [ClientsService, ClientOrgSettingsService],
})
export class ClientsModule {}

