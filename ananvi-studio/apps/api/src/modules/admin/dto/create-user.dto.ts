import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsArray } from 'class-validator';
import { UserRole } from '@ananvi/shared';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}
