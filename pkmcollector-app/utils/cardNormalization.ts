import { CardResult, CardSetInfo } from '@/types/card';

const pickImage = (card: Record<string, any>): string | undefined => {
  if (typeof card.image === 'string') return card.image;

  if (card.image && typeof card.image === 'object') {
    return card.image.high ?? card.image.large ?? card.image.small ?? card.image.url;
  }

  if (card.images && typeof card.images === 'object') {
    return card.images.high ?? card.images.large ?? card.images.small ?? card.images.url;
  }

  return card.img_url ?? card.img ?? card.imgUrl ?? card.imageUrl;
};

const normalizeSet = (card: Record<string, any>): CardSetInfo | undefined => {
  if (card.set && typeof card.set === 'object') {
    return {
      id: card.set.id ?? card.setId,
      name:
        card.set.name ??
        card.setName ??
        card.set.fullName,
      logo: card.set.logo ?? card.setLogo,
      symbol: card.set.symbol ?? card.setSymbol,
    };
  }

  if (card.setName || card.setId) {
    return {
      id: card.setId,
      name: card.setName,
    };
  }

  return undefined;
};

export const normalizeCardResult = (
  card: Record<string, any>,
  fallbackIndex = 0,
): CardResult | null => {
  if (!card) return null;

  const baseId =
    card.id ??
    card.card_id ??
    card.uuid ??
    card.slug ??
    [card.set?.id, card.localId ?? card.number, card.name].filter(Boolean).join('-') ??
    `card-${fallbackIndex}`;

  const name = card.name ?? card.cardName ?? card.title ?? card.id ?? 'Card';
  const image = pickImage(card);
  const variants =
    typeof card.variants === 'object' && card.variants !== null ? card.variants : undefined;

  const normalized: CardResult = {
    id: String(baseId),
    name: String(name),
    image,
    category: card.category ?? card.supertype ?? card.type,
    illustrator: card.illustrator,
    localId: card.localId ?? card.local_id ?? card.number,
    rarity: card.rarity,
    set: normalizeSet(card),
    variants,
    description: card.description ?? card.flavorText ?? card.rules?.join('\n'),
  };

  return normalized;
};

const extractArray = (raw: unknown): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'object') {
    if (Array.isArray((raw as any).cards)) return (raw as any).cards;
    if (Array.isArray((raw as any).results)) return (raw as any).results;
    if (Array.isArray((raw as any).data)) return (raw as any).data;
  }

  return [raw];
};

export const normalizeCardsResponse = (raw: unknown): CardResult[] => {
  const collection = extractArray(raw);

  return collection
    .map((item, index) => (item && typeof item === 'object' ? normalizeCardResult(item, index) : null))
    .filter((card): card is CardResult => Boolean(card));
};
