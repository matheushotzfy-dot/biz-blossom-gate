import { describe, it, expect } from 'vitest';
import { validDays, activityDate, emailLink, inactiveCSV } from './model';

describe('Admin Inactive Model', () => {
  it('validates days correctly', () => {
    expect(validDays('7')).toBe(7);
    expect(validDays('0')).toBe(null);
    expect(validDays('3651')).toBe(null);
    expect(validDays('abc')).toBe(null);
  });

  it('formats activity date', () => {
    const date = '2023-10-27T10:00:00Z';
    expect(activityDate(date)).toContain('27/10/2023');
  });

  it('generates email links safely', () => {
    expect(emailLink('test@example.com')).toBe('mailto:test%40example.com');
    expect(emailLink('invalid-email')).toBe(null);
  });

  it('prevents CSV injection', () => {
    const mockData: any = {
      sellers: [{
        user_id: '1',
        full_name: '=SUM(1,2)',
        email: 'test@example.com',
        days_since: 10,
        last_activity: '2023-10-27T10:00:00Z',
        sales: 0,
        attempts: 0,
        volume: 0,
        fees: 0
      }],
      page: 0,
      totals: { count: 1 }
    };
    const csv = inactiveCSV(mockData, 7);
    expect(csv).toContain('"' + "'=SUM(1,2)" + '"');
  });
});
