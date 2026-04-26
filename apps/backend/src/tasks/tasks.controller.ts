import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TaskStatus, Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(AuthGuard, RolesGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  @Roles(Role.WORKER)
  list(@Req() req: { user: { id: string; role: Role; activeOrganizationId: string } }) {
    return this.tasks.list(req.user.activeOrganizationId, req.user.id, req.user.role);
  }

  @Get('pending-count')
  @Roles(Role.WORKER)
  pendingCount(@Req() req: { user: { id: string; activeOrganizationId: string } }) {
    return this.tasks.pendingCountForMe(
      req.user.activeOrganizationId,
      req.user.id,
    );
  }

  @Post()
  @Roles(Role.MANAGER)
  create(
    @Req() req: { user: { id: string; activeOrganizationId: string } },
    @Body()
    body: {
      title: string;
      description?: string | null;
      assigneeId: string;
      dueAt?: string | null;
      startsAt?: string | null;
    },
  ) {
    return this.tasks.create(
      req.user.activeOrganizationId,
      req.user.id,
      body,
    );
  }

  @Patch(':id')
  @Roles(Role.WORKER)
  update(
    @Req() req: { user: { id: string; role: Role; activeOrganizationId: string } },
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      dueAt?: string | null;
      startsAt?: string | null;
      assigneeId?: string;
    },
  ) {
    if (req.user.role === Role.WORKER) {
      if (body.status === undefined) {
        throw new BadRequestException('только смена статуса');
      }
      return this.tasks.update(
        req.user.activeOrganizationId,
        req.user.id,
        req.user.role,
        id,
        { status: body.status },
      );
    }
    return this.tasks.update(
      req.user.activeOrganizationId,
      req.user.id,
      req.user.role,
      id,
      body,
    );
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  remove(
    @Req() req: { user: { id: string; activeOrganizationId: string } },
    @Param('id') id: string,
  ) {
    return this.tasks.remove(
      req.user.activeOrganizationId,
      req.user.id,
      id,
    );
  }
}
