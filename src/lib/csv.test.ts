import { describe, expect, it } from 'vitest';
import { csvEscape } from './csv';

describe('csvEscape', () => {
  it('renvoie une chaîne vide pour null et undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('laisse intactes les valeurs simples', () => {
    expect(csvEscape('Coupe homme')).toBe('Coupe homme');
    expect(csvEscape('Agence Maârif – café')).toBe('Agence Maârif – café');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(0)).toBe('0');
    expect(csvEscape(false)).toBe('false');
  });

  it('double les guillemets et entoure la cellule', () => {
    expect(csvEscape('Salon "Atlas"')).toBe('"Salon ""Atlas"""');
  });

  it.each([
    ['a,b', '"a,b"'],
    ['a;b', '"a;b"'],
    ['ligne 1\nligne 2', '"ligne 1\nligne 2"'],
    ['a\r\nb', '"a\r\nb"'],
  ])('met entre guillemets %j', (input, expected) => {
    expect(csvEscape(input)).toBe(expected);
  });

  it.each([
    ['=SUM(A1:A9)', "'=SUM(A1:A9)"],
    ['+212600000000', "'+212600000000"],
    ['-2+3', "'-2+3"],
    ['@SUM(1)', "'@SUM(1)"],
    ['\t=1', "'\t=1"],
  ])('neutralise la formule %j', (input, expected) => {
    expect(csvEscape(input)).toBe(expected);
  });

  it('neutralise puis échappe une formule avec guillemets et virgules', () => {
    expect(csvEscape('=HYPERLINK("http://evil.test","clic")')).toBe('"\'=HYPERLINK(""http://evil.test"",""clic"")"');
  });

  it('neutralise un retour chariot initial et met la cellule entre guillemets', () => {
    expect(csvEscape('\r=1+1')).toBe('"\'\r=1+1"');
  });

  it('ne touche pas un signe placé au milieu de la valeur', () => {
    expect(csvEscape('a=b')).toBe('a=b');
    expect(csvEscape('06-12-34-56')).toBe('06-12-34-56');
  });

  it('préfixe aussi un nombre négatif (converti en texte)', () => {
    expect(csvEscape(-5)).toBe("'-5");
  });
});
