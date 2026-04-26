import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private profile: ProfileService) {}

  @Get()
  get(@Req() req: any) {
    return this.profile.getProfile(req.user.id);
  }

  @Patch()
  update(
    @Req() req: any,
    @Body() body: { name?: string | null; email?: string; phone?: string | null; telegram?: string | null; contacts?: string | null },
  ) {
    return this.profile.updateProfile(req.user.id, body);
  }

  @Patch('password')
  changePassword(
    @Req() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.profile.changePassword(req.user.id, body.oldPassword, body.newPassword);
  }
}
