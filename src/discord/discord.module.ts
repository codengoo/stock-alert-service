import { Global, Module } from '@nestjs/common';
import { DiscordInteractionService } from './discord-interaction.service';
import { DiscordService } from './discord.service';

@Global()
@Module({
  providers: [DiscordService, DiscordInteractionService],
  exports: [DiscordService, DiscordInteractionService],
})
export class DiscordModule {}
