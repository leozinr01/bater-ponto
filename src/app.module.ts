import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AbsencesModule } from './absences/absences.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { HolidaysModule } from './holidays/holidays.module';
import { DatabaseModule } from './infra/database/database.module';
import { envSchema } from './infra/env/env';
import { PunchesModule } from './punches/punches.module';
import { PushModule } from './push/push.module';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module';
import { WorkplacesModule } from './workplaces/workplaces.module';

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
    HolidaysModule,
    AbsencesModule,
    WorkplacesModule,
    PunchesModule,
    PushModule,
  ],
})
export class AppModule {}
