import { Module } from '@nestjs/common';
import { MaterialsModule } from '../materials/materials.module.js';
import { StudyGuidesRepository } from './study-guides.repository.js';
import { StudyGuidesService } from './study-guides.service.js';
import { StudyGuidesController } from './study-guides.controller.js';

@Module({
  imports: [MaterialsModule],
  providers: [StudyGuidesRepository, StudyGuidesService],
  controllers: [StudyGuidesController],
  exports: [StudyGuidesRepository, StudyGuidesService],
})
export class StudyGuidesModule {}
