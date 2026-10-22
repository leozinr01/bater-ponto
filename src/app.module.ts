import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { DatabaseModule } from './infra/database/database.module';
import { envSchema } from './infra/env/env';
import { PunchesModule } from './punches/punches.module';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    DatabaseModule,
    AuthModule,
    EmployeesModule,
    WorkSchedulesModule,
    PunchesModule,
  ],
})
export class AppModule {}
