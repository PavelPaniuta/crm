import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(AuthGuard, RolesGuard)
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get('messages')
  @Roles(Role.WORKER)
  getMessages(
    @Req() req: { user: { activeOrganizationId: string } },
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.chat.getMessages(
      req.user.activeOrganizationId,
      limit ? Math.min(Number(limit), 100) : 50,
      before,
    );
  }

  @Post('messages')
  @Roles(Role.WORKER)
  sendMessage(
    @Req() req: { user: { id: string; activeOrganizationId: string } },
    @Body() body: { text: string },
  ) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('text required');
    if (text.length > 4000) throw new BadRequestException('text too long');
    return this.chat.sendMessage(req.user.activeOrganizationId, req.user.id, text);
  }

  @Post('read')
  @Roles(Role.WORKER)
  markRead(@Req() req: { user: { id: string; activeOrganizationId: string } }) {
    return this.chat.markRead(req.user.activeOrganizationId, req.user.id);
  }

  @Get('unread')
  @Roles(Role.WORKER)
  unreadCount(@Req() req: { user: { id: string; activeOrganizationId: string } }) {
    return this.chat.unreadCount(req.user.activeOrganizationId, req.user.id);
  }
}
