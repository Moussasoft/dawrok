import { describe, expect, it } from 'vitest';
import { isTextable, maskPhone, toE164 } from './phone';

describe('toE164', () => {
  it('normalise les formats marocains courants', () => {
    for (const raw of ['0612345678', '06 12 34 56 78', '06.12.34.56.78', '06-12-34-56-78', '+212612345678', '00212612345678', '212612345678', '+212 0612345678', '612345678']) {
      expect(toE164(raw), raw).toBe('+212612345678');
    }
    expect(toE164('0522123456')).toBe('+212522123456');
  });

  it('garde les numéros internationaux valides', () => {
    expect(toE164('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(toE164('0033612345678')).toBe('+33612345678');
  });

  it('refuse les saisies invalides', () => {
    for (const raw of ['', '12', 'abc', '0812345678', '+0612345678', '06123456', null, undefined]) {
      expect(toE164(raw), String(raw)).toBeNull();
    }
  });
});

describe('isTextable', () => {
  it('accepte les mobiles, refuse les fixes marocains', () => {
    expect(isTextable('+212612345678')).toBe(true);
    expect(isTextable('+212712345678')).toBe(true);
    expect(isTextable('+212522123456')).toBe(false);
    expect(isTextable('+33612345678')).toBe(true);
    expect(isTextable(null)).toBe(false);
  });
});

describe('maskPhone', () => {
  it('ne garde que le début et la fin', () => {
    expect(maskPhone('+212612345678')).toBe('+2126••••••78');
  });
});
