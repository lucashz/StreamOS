import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';
export const PERMISSION_METADATA = 'streamos:permission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_METADATA, permission);
