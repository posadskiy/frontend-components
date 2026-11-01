import { afterEach, describe, expect, it, vi } from 'vitest';
import { languageLabel, languageOptions } from './regional';

const unnamed = new Set(['ch', 'cr', 'cu', 'cv']);

function mockUnnamedLanguages(codes: Set<string>) {
  const Original = Intl.DisplayNames;
  function DisplayNames(this: Intl.DisplayNames, locales: Intl.LocalesArgument, options?: Intl.DisplayNamesOptions) {
    const real = new Original(locales, options);
    this.of = (code: string) => (codes.has(code) ? code : Original.prototype.of.call(real, code));
  }
  vi.spyOn(Intl, 'DisplayNames').mockImplementation(DisplayNames as unknown as typeof Intl.DisplayNames);
}

describe('languageOptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists readable language names and hides codes the runtime cannot name', () => {
    mockUnnamedLanguages(unnamed);

    const options = languageOptions('en');
    expect(options.some((option) => option.id === 'en' && /English/.test(option.label))).toBe(true);
    expect(options.some((option) => option.id === 'de' && option.label.includes('German'))).toBe(true);
    expect(options.some((option) => option.id === 'co' && /Corsican/.test(option.label))).toBe(true);
    for (const option of options) {
      expect(option.label.toLowerCase()).not.toBe(option.id.toLowerCase());
    }
    expect(options.find((option) => unnamed.has(option.id))).toBeUndefined();
  });

  it('keeps a saved language even when it has no display name', () => {
    mockUnnamedLanguages(new Set(['ch']));

    const options = languageOptions('en', 'ch');
    expect(options.filter((option) => option.id === 'ch')).toEqual([{ id: 'ch', label: 'ch' }]);
    expect(languageLabel('en', 'en')).toMatch(/English/);
  });
});
