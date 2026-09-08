export const PERMISSIONS = [
  'wallet:read',
  'wallet:write',
  'contributions:read',
  'settings:write',
  'campaigns:read',
  'campaigns:write',
  'subscriptions:read',
  'subscriptions:write',
  'songpix:read',
  'songpix:write',
  'videopix:read',
  'videopix:write',
  'live:read',
  'live:operate',
  'widgets:read',
  'widgets:write',
  'alerts:read',
  'alerts:write',
  'alerts:test',
  'moderation:read',
  'moderation:write',
  'team:read',
  'team:write',
  'tokens:write',
  'webhooks:write',
  'integrations:write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);
const READ = new Set<Permission>(
  PERMISSIONS.filter((item) => item.endsWith(':read')),
);
const ROLE_PERMISSIONS: Readonly<Record<string, ReadonlySet<Permission>>> = {
  OWNER: ALL,
  ADMIN: new Set(PERMISSIONS.filter((item) => item !== 'wallet:write')),
  MODERATOR: new Set([
    'contributions:read',
    'campaigns:read',
    'subscriptions:read',
    'songpix:read',
    'songpix:write',
    'videopix:read',
    'videopix:write',
    'live:read',
    'live:operate',
    'widgets:read',
    'alerts:read',
    'alerts:test',
    'moderation:read',
    'moderation:write',
  ]),
  FINANCE: new Set([
    'wallet:read',
    'wallet:write',
    'contributions:read',
    'campaigns:read',
    'subscriptions:read',
  ]),
  VIEWER: READ,
};
export function hasPermission(role: string, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
export function permissionsFor(role: string) {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
