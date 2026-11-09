import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class SubscriptionKeysDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) p256dh: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) auth: string;
}

/** Inscrição gerada pelo navegador (PushSubscription.toJSON()). */
export class SubscribeDto {
  @ApiProperty({ description: 'Endereço do serviço de push do navegador' })
  @IsUrl(
    { protocols: ['https'], require_tld: true },
    { message: 'endpoint inválido' },
  )
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ type: SubscriptionKeysDto })
  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys: SubscriptionKeysDto;
}

export class UnsubscribeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  endpoint: string;
}

export class EmailRemindersDto {
  @ApiProperty()
  @IsBoolean({ message: 'enabled deve ser true ou false' })
  enabled: boolean;
}
