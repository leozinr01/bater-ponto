import { EnvModule } from '@/infra/env/env.module';
import { PunchesModule } from '@/punches/punches.module';
import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { ReminderMailer } from './mailer';
import { PushService } from './push.service';

@Module({
  imports: [EnvModule, PunchesModule],
  controllers: [PushController],
  providers: [PushService, ReminderMailer],
})
export class PushModule {}
