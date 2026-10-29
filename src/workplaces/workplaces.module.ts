import { Module } from '@nestjs/common';
import { WorkplacesController } from './workplaces.controller';
import { WorkplacesService } from './workplaces.service';

@Module({
  controllers: [WorkplacesController],
  providers: [WorkplacesService],
  exports: [WorkplacesService],
})
export class WorkplacesModule {}
