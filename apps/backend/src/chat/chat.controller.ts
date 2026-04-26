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

  /** All org users (to start a conversation) */
  @Get('users')
  @Roles(Role.WORKER)
  getOrgUsers(@Req() req: { user: { id: string; activeOrganizationId: string } }) {
    return this.chat.getOrgUsers(req.user.activeOrganizationId, req.user.id);
  }

  /** Conversations list with last message + unread */
  @Get('conversations')
  @Roles(Role.WORKER)
  getConversations(@Req() req: { user: { id: string; activeOrganizationId: string } }) {
    return this.chat.getConversations(req.user.activeOrganizationId, req.user.id);
  }

  /** DM history with a specific user */
  @Get('messages')
  @Roles(Role.WORKER)
  getMessages(
    @Req() req: { user: { id: string; activeOrganizationId: string } },
    @Query('with') withUserId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    if (!withUserId) throw new BadRequestException('with required');
    return this.chat.getMessages(
      req.user.activeOrganizationId,
      req.user.id,
      withUserId,
      limit ? Math.min(Number(limit), 100) : 50,
      before,
    );
  }

  /** Send DM */
  @Post('messages')
  @Roles(Role.WORKER)
  sendMessage(
    @Req() req: { user: { id: string; activeOrganizationId: string } },
    @Body() body: { text: string; receiverId: string },
  ) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('text required');
    if (!body.receiverId) throw new BadRequestException('receiverId required');
    if (text.length > 4000) throw new BadRequestException('text too long');
    return this.chat.sendMessage(
      req.user.activeOrganizationId,
      req.user.id,
      body.receiverId,
      text,
    );
  }

  /** Mark conversation as read */
  @Post('read')
  @Roles(Role.WORKER)
  markRead(
    @Req() req: { user: { id: string } },
    @Body() body: { otherUserId: string },
  ) {
    if (!body.otherUserId) throw new BadRequestException('otherUserId required');
    return this.chat.markRead(req.user.id, body.otherUserId);
  }

  /** Total unread count across all DMs */
  @Get('unread')
  @Roles(Role.WORKER)
  unreadTotal(@Req() req: { user: { id: string; activeOrganizationId: string } }) {
    return this.chat.unreadTotal(req.user.activeOrganizationId, req.user.id);
  }
}
