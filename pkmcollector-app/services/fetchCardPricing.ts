import { CardPricing, CardPricingVariant, PricingVariantType } from '@/types/card';

const BASE_URL = 'https://api.tcgdex.net/v2/en/cards/';
const USD_TO_EUR = 0.92;

type RawVariantPricing = {
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number;
};

type RawResponse = {
  pricing?: {
    tcgplayer?: {
      updated?: string;
      unit?: string;
      [variant: string]: RawVariantPricing | string | undefined;
    };
  };
};

const convertUsdToEur = (value?: number): number | undefined => {
  if (typeof value !== 'number') return undefined;
  return Number((value * USD_TO_EUR).toFixed(2));
};

const mapVariant = (variant?: RawVariantPricing): CardPricingVariant | undefined => {
  if (!variant) return undefined;

  const converted: CardPricingVariant = {
    lowPrice: convertUsdToEur(variant.lowPrice),
    midPrice: convertUsdToEur(variant.midPrice),
    highPrice: convertUsdToEur(variant.highPrice),
    marketPrice: convertUsdToEur(variant.marketPrice),
    directLowPrice: convertUsdToEur(variant.directLowPrice),
    currency: 'EUR',
  };

  const hasValue = Object.values(converted).some(
    (value) => typeof value === 'number' && !Number.isNaN(value),
  );
  return hasValue ? converted : undefined;
};

export const fetchCardPricing = async (cardId: string): Promise<CardPricing | null> => {
  if (!cardId) return null;

  try {
    const response = await fetch(`${BASE_URL}${cardId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch pricing for ${cardId}`);
    }

    const payload = (await response.json()) as RawResponse;
    const tcgplayer = payload.pricing?.tcgplayer;
    if (!tcgplayer) return null;

    const variants: Record<PricingVariantType, CardPricingVariant> = {};

    Object.entries(tcgplayer).forEach(([key, value]) => {
      if (key === 'updated' || key === 'unit') return;
      if (!value || typeof value !== 'object') return;
      const mapped = mapVariant(value as RawVariantPricing);
      if (mapped) {
        variants[key] = mapped;
      }
    });

    if (!Object.keys(variants).length) return null;

    return {
      updated: tcgplayer.updated,
      variants,
    };
  } catch (err) {
    console.error('Unable to fetch card pricing', err);
    throw err;
  }
};
