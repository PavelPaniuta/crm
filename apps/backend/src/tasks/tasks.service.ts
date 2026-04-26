import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TaskStatus, Role } from '@prisma/client';

const isWorker = (r: Role) => r === 'WORKER';
const isManagerOrAbove = (r: Role) => r === 'MANAGER' || r === 'ADMIN' || r === 'SUPER_ADMIN';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  private async userInOrg(userId: string, orgId: string) {
    const u = await this.prisma.user.findFirst({
      where: {
        id: userId,
        OR: [
          { organizationId: orgId },
          { memberships: { some: { organizationId: orgId } } },
        ],
      },
      select: { id: true, email: true, name: true },
    });
    return u;
  }

  async list(organizationId: string, userId: string, role: Role) {
    const where = isWorker(role)
      ? { organizationId, assigneeId: userId }
      : { organizationId };

    return this.prisma.task.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async pendingCountForMe(organizationId: string, userId: string) {
    const n = await this.prisma.task.count({
      where: {
        organizationId,
        assigneeId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
    });
    return { count: n };
  }

  async create(
    organizationId: string,
    userId: string,
    data: {
      title: string;
      description?: string | null;
      assigneeId: string;
      dueAt?: string | null;
      startsAt?: string | null;
    },
  ) {
    const title = data.title?.trim();
    if (!title) throw new BadRequestException('title required');
    if (!data.assigneeId) throw new BadRequestException('assigneeId required');

    const assignee = await this.userInOrg(data.assigneeId, organizationId);
    if (!assignee) throw new BadRequestException('исполнитель не в этом офисе');

    const task = await this.prisma.task.create({
      data: {
        title,
        description: data.description?.trim() || null,
        organizationId,
        assigneeId: data.assigneeId,
        createdById: userId,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    if (this.mail.isConfigured()) {
      const appUrl = process.env.APP_URL || 'https://my-crm.live';
      try {
        await this.mail.sendTaskAssigned(task.assignee.email, {
          taskTitle: task.title,
          description: task.description,
          dueAt: task.dueAt,
          assignerName: task.createdBy.name || task.createdBy.email,
          appUrl,
        });
      } catch (e) {
        console.error('Task assigned email failed', e);
      }
    }

    return task;
  }

  async update(
    organizationId: string,
    userId: string,
    role: Role,
    taskId: string,
    data: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      dueAt?: string | null;
      startsAt?: string | null;
      assigneeId?: string;
    },
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: { assignee: true, createdBy: true },
    });
    if (!task) throw new NotFoundException();

    if (isWorker(role)) {
      if (task.assigneeId !== userId) throw new ForbiddenException();
      if (data.status === undefined) throw new BadRequestException('только смена статуса');
      const allowed: TaskStatus[] = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
      if (!allowed.includes(data.status)) throw new BadRequestException('недопустимый статус');
    }

    if (isWorker(role)) {
      const prev = task.status;
      const next = data.status!;
      const updated = await this.prisma.task.update({
        where: { id: taskId },
        data: { status: data.status, updatedAt: new Date() },
        include: {
          assignee: { select: { id: true, email: true, name: true } },
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });
      if (
        this.mail.isConfigured() &&
        prev !== TaskStatus.DONE &&
        next === TaskStatus.DONE &&
        task.createdById !== task.assigneeId
      ) {
        const appUrl = process.env.APP_URL || 'https://my-crm.live';
        try {
          await this.mail.sendTaskCompleted(task.createdBy.email, {
            taskTitle: task.title,
            assigneeName: task.assignee.name || task.assignee.email,
            appUrl,
          });
        } catch (e) {
          console.error('Task completed email failed', e);
        }
      }
      return updated;
    }

    if (!isManagerOrAbove(role)) throw new ForbiddenException();

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) {
      const trimmed = data.title.trim();
      if (!trimmed) throw new BadRequestException('title required');
      patch.title = trimmed;
    }
    if (data.description !== undefined) patch.description = data.description?.trim() || null;
    if (data.status !== undefined) patch.status = data.status;
    if (data.dueAt !== undefined) patch.dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (data.startsAt !== undefined) patch.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.assigneeId !== undefined) {
      const a = await this.userInOrg(data.assigneeId, organizationId);
      if (!a) throw new BadRequestException('исполнитель не в этом офисе');
      patch.assigneeId = data.assigneeId;
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: patch as any,
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async remove(organizationId: string, _userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId } });
    if (!task) throw new NotFoundException();
    await this.prisma.task.delete({ where: { id: taskId } });
    return { ok: true };
  }

  async getComments(organizationId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId } });
    if (!task) throw new NotFoundException();
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async addComment(organizationId: string, taskId: string, authorId: string, body: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId } });
    if (!task) throw new NotFoundException();
    const text = body?.trim();
    if (!text) throw new BadRequestException('body required');
    return this.prisma.taskComment.create({
      data: { taskId, authorId, body: text },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }
}
