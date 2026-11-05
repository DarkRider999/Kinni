import { IsArray, IsEnum } from 'class-validator';
import { UserRole } from '@ananvi/shared';

export class UpdateUserRoleDto {
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}
