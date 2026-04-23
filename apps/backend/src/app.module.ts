import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { DealsModule } from './deals/deals.module';
import { OrgsModule } from './orgs/orgs.module';
import { UsersModule } from './users/users.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrgsModule,
    ClientsModule,
    DealsModule,
    UsersModule,
    ExpensesModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
