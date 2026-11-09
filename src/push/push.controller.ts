import { AuthUser, CurrentUser, Public } from '@/auth/decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SubscribeDto, UnsubscribeDto } from './push.dto';
import { PushService } from './push.service';

@ApiTags('Lembretes')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Se os lembretes estão ligados e a chave pública VAPID',
  })
  config() {
    return this.push.config();
  }

  @Post('subscriptions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ativa os lembretes neste aparelho' })
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.push.subscribe(user.id, dto);
  }

  @Delete('subscriptions')
  @ApiOperation({ summary: 'Desativa os lembretes neste aparelho' })
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(user.id, dto.endpoint);
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envia uma notificação de teste aos meus aparelhos',
  })
  test(@CurrentUser() user: AuthUser) {
    return this.push.test(user.id);
  }

  @Public()
  @Post('tick')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envia os lembretes devidos agora (chamado pelo agendador)',
    description: 'Exige Authorization: Bearer <CRON_SECRET>.',
  })
  @ApiUnauthorizedResponse({ description: 'Segredo ausente ou errado' })
  tick(@Headers('authorization') authorization?: string) {
    return this.push.tick(authorization);
  }
}
