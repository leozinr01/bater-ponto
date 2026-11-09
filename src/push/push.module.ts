import { EnvModule } from '@/infra/env/env.module';
import { PunchesModule } from '@/punches/punches.module';
import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [EnvModule, PunchesModule],
  controllers: [PushController],
  providers: [PushService],
})
export class PushModule {}
