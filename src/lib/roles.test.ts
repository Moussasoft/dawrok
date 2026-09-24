import { describe, expect, it } from 'vitest';
import { hasRole, isRole, wouldLeaveNoOwner } from './roles';

describe('rôles', () => {
  it('hiérarchie owner > manager > staff', () => {
    expect(hasRole('owner', 'manager')).toBe(true);
    expect(hasRole('manager', 'manager')).toBe(true);
    expect(hasRole('manager', 'owner')).toBe(false);
    expect(hasRole('staff', 'staff')).toBe(true);
    expect(hasRole('staff', 'manager')).toBe(false);
  });
  it('un rôle inconnu n’a aucun droit', () => {
    expect(isRole('admin')).toBe(false);
    expect(hasRole('admin', 'staff')).toBe(false);
  });
  it('empêche de retirer le dernier propriétaire', () => {
    expect(wouldLeaveNoOwner('owner', 'manager', 1)).toBe(true);
    expect(wouldLeaveNoOwner('owner', null, 1)).toBe(true);
    expect(wouldLeaveNoOwner('owner', 'manager', 2)).toBe(false);
    expect(wouldLeaveNoOwner('manager', null, 1)).toBe(false);
    expect(wouldLeaveNoOwner('owner', 'owner', 1)).toBe(false);
  });
});
