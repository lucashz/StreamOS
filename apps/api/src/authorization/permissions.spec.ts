import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions';
describe('global RBAC matrix', () => {
  it('gives the owner every sensitive operation', () => {
    expect(hasPermission('OWNER', 'wallet:write')).toBe(true);
    expect(hasPermission('OWNER', 'tokens:write')).toBe(true);
  });
  it('prevents administrators from requesting payouts by default', () => {
    expect(hasPermission('ADMIN', 'wallet:write')).toBe(false);
    expect(hasPermission('ADMIN', 'widgets:write')).toBe(true);
  });
  it('limits moderators to broadcast and moderation operations', () => {
    expect(hasPermission('MODERATOR', 'live:operate')).toBe(true);
    expect(hasPermission('MODERATOR', 'moderation:write')).toBe(true);
    expect(hasPermission('MODERATOR', 'campaigns:write')).toBe(false);
    expect(hasPermission('MODERATOR', 'wallet:write')).toBe(false);
  });
  it('allows finance to operate the wallet but not widgets', () => {
    expect(hasPermission('FINANCE', 'wallet:write')).toBe(true);
    expect(hasPermission('FINANCE', 'widgets:write')).toBe(false);
  });
  it('keeps viewers read-only', () => {
    expect(hasPermission('VIEWER', 'wallet:read')).toBe(true);
    expect(hasPermission('VIEWER', 'alerts:write')).toBe(false);
  });
});
