const LOCALE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/;

export interface BrowserRegion {
  locale?: string;
  timeZone?: string;
}

function knownTimeZone(zone: string): boolean {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone').includes(zone);
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Locale and IANA time zone from the browser, sent once at account creation. */
export function browserRegion(): BrowserRegion {
  const region: BrowserRegion = {};
  const locale = typeof navigator !== 'undefined' ? navigator.language?.trim() : '';
  if (locale && locale.length <= 35 && LOCALE_TAG.test(locale)) {
    region.locale = locale;
  }
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (timeZone && timeZone.length <= 64 && knownTimeZone(timeZone)) {
      region.timeZone = timeZone;
    }
  } catch {
    // Sign-up still proceeds. The account can set a zone later.
  }
  return region;
}
