import { Module } from '@nestjs/common';
import {
  CompletionsService,
  OPENAI_CLIENT_FACTORY,
  openAiClientFactory,
} from './completions.service.js';

@Module({
  providers: [
    CompletionsService,
    { provide: OPENAI_CLIENT_FACTORY, useValue: openAiClientFactory },
  ],
  exports: [CompletionsService],
})
export class AiCompletionsModule {}
