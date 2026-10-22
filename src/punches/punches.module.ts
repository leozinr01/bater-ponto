import { EnvModule } from '@/infra/env/env.module';
import { Module } from '@nestjs/common';
import { PunchesController } from './punches.controller';
import { PunchesService } from './punches.service';

@Module({
  imports: [EnvModule],
  controllers: [PunchesController],
  providers: [PunchesService],
})
export class PunchesModule {}
