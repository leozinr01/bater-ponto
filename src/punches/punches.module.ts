import { AbsencesModule } from '@/absences/absences.module';
import { HolidaysModule } from '@/holidays/holidays.module';
import { EnvModule } from '@/infra/env/env.module';
import { Module } from '@nestjs/common';
import { PunchesController } from './punches.controller';
import { PunchesService } from './punches.service';

@Module({
  imports: [EnvModule, HolidaysModule, AbsencesModule],
  controllers: [PunchesController],
  providers: [PunchesService],
})
export class PunchesModule {}
