import { EnvModule } from '@/infra/env/env.module';
import { Module } from '@nestjs/common';
import { WorkSchedulesController } from './work-schedules.controller';
import { WorkSchedulesService } from './work-schedules.service';

@Module({
  imports: [EnvModule],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
