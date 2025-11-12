export type CardSetInfo = {
  id?: string;
  name?: string;
  logo?: string;
  symbol?: string;
};

export type CardVariants = Record<string, string | boolean | number | null | undefined>;

export type CardResult = {
  id: string;
  name: string;
  image?: string;
  category?: string;
  illustrator?: string;
  localId?: string;
  rarity?: string;
  set?: CardSetInfo;
  variants?: CardVariants;
  description?: string;
};

export type PricingVariantType = string;

export type CardPricingVariant = {
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number;
  currency: 'EUR';
};

export type CardPricing = {
  updated?: string;
  variants: Record<PricingVariantType, CardPricingVariant>;
};
