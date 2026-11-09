import { EnvModule } from '@/infra/env/env.module';
import { Module } from '@nestjs/common';
import { ReverseGeocoder } from './reverse-geocode';
import { WorkplacesController } from './workplaces.controller';
import { WorkplacesService } from './workplaces.service';

@Module({
  imports: [EnvModule],
  controllers: [WorkplacesController],
  providers: [WorkplacesService, ReverseGeocoder],
  exports: [WorkplacesService, ReverseGeocoder],
})
export class WorkplacesModule {}
