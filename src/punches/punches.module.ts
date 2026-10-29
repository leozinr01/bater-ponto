import { AbsencesModule } from '@/absences/absences.module';
import { HolidaysModule } from '@/holidays/holidays.module';
import { HourBankController } from '@/hour-bank/hour-bank.controller';
import { HourBankService } from '@/hour-bank/hour-bank.service';
import { EnvModule } from '@/infra/env/env.module';
import { WorkplacesModule } from '@/workplaces/workplaces.module';
import { Module } from '@nestjs/common';
import { PunchesController } from './punches.controller';
import { PunchesService } from './punches.service';

@Module({
  imports: [EnvModule, HolidaysModule, AbsencesModule, WorkplacesModule],
  controllers: [PunchesController, HourBankController],
  providers: [PunchesService, HourBankService],
})
export class PunchesModule {}
