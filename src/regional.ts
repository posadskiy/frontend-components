export interface RegionOption {
  id: string;
  label: string;
  group?: string;
}

/** ISO 639-1 codes. The profile stores a language tag, not a free-typed locale. */
const LANGUAGE_CODES = [
  'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
  'ba', 'be', 'bg', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
  'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy',
  'da', 'de', 'dv', 'dz',
  'ee', 'el', 'en', 'eo', 'es', 'et', 'eu',
  'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
  'ga', 'gd', 'gl', 'gn', 'gu', 'gv',
  'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu',
  'ja', 'jv',
  'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky',
  'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
  'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
  'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
  'oc', 'oj', 'om', 'or', 'os',
  'pa', 'pi', 'pl', 'ps', 'pt',
  'qu',
  'rm', 'rn', 'ro', 'ru', 'rw',
  'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw',
  'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
  'ug', 'uk', 'ur', 'uz',
  've', 'vi', 'vo',
  'wa', 'wo',
  'xh',
  'yi', 'yo',
  'za', 'zh', 'zu',
] as const;

const LOCALE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/;

export function uiLocale(preferred?: string | null): string {
  const candidate = preferred?.trim() || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en';
  return LOCALE_TAG.test(candidate) ? candidate : 'en';
}

export function languageLabel(tag: string, locale: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';
  try {
    const native = new Intl.DisplayNames([trimmed, locale], { type: 'language' }).of(trimmed);
    const current = new Intl.DisplayNames([locale], { type: 'language' }).of(trimmed);
    if (native && current && native.toLowerCase() !== current.toLowerCase() && native !== trimmed) {
      return `${native} — ${current}`;
    }
    if (native && native !== trimmed) return native;
    if (current && current !== trimmed) return current;
  } catch {
    // An unrecognized tag is shown as stored.
  }
  return trimmed;
}

export function languageOptions(locale: string, current?: string | null): RegionOption[] {
  const ids = new Set<string>(LANGUAGE_CODES);
  const extra = current?.trim();
  if (extra) ids.add(extra);
  return [...ids]
    .map((id) => ({ id, label: languageLabel(id, locale) }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}

export function timeZoneIds(): string[] {
  if (typeof Intl === 'undefined' || typeof Intl.supportedValuesOf !== 'function') return [];
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

export function timeZoneLabel(zone: string, locale: string): string {
  const city = zone.split('/').at(-1)?.replaceAll('_', ' ') || zone;
  const area = zone.includes('/') ? zone.slice(0, zone.lastIndexOf('/')).replaceAll('_', ' ') : '';
  const place = area ? `${city} (${area})` : city;
  try {
    const generic = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    if (generic && generic !== zone) return `${place} — ${generic}`;
  } catch {
    // Keep the IANA id visible when the runtime cannot name the zone.
  }
  return `${place} — ${zone}`;
}

export function timeZoneOptions(locale: string, current?: string | null): RegionOption[] {
  const ids = new Set(timeZoneIds());
  const extra = current?.trim();
  if (extra) ids.add(extra);
  return [...ids]
    .map((id) => ({
      id,
      label: timeZoneLabel(id, locale),
      group: id.includes('/') ? id.slice(0, id.indexOf('/')) : id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}

export function matchesOption(options: RegionOption[], query: string): RegionOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter(
    (option) => option.label.toLowerCase().includes(needle) || option.id.toLowerCase().includes(needle),
  );
}
