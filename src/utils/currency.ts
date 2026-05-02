import * as Localization from 'expo-localization';

function getCurrencyCode(): string {
  const region = Localization.getLocales()[0]?.regionCode ?? 'IN';
  const regionToCurrency: Record<string, string> = {
    IN: 'INR',
    US: 'USD',
    GB: 'GBP',
    EU: 'EUR',
    AU: 'AUD',
    CA: 'CAD',
    SG: 'SGD',
    AE: 'AED',
    JP: 'JPY',
    CN: 'CNY',
  };
  return regionToCurrency[region] ?? 'INR';
}

function getLocale(): string {
  const locale = Localization.getLocales()[0]?.languageTag ?? 'en-IN';
  const region = Localization.getLocales()[0]?.regionCode ?? 'IN';
  return region === 'IN' ? 'en-IN' : locale;
}

export function formatCurrency(paise: number): string {
  const amount = paise / 100;
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: getCurrencyCode(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parsePaise(displayAmount: string): number {
  const cleaned = displayAmount.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}
