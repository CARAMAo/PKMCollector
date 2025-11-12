import { CardResult } from '@/types/card';
import { normalizeCardsResponse } from '@/utils/cardNormalization';

const TEXT_SEARCH_URL = 'https://functions-pkmcollector.azurewebsites.net/api/text-search';

export const searchCards = async (query: string): Promise<CardResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const response = await fetch(`${TEXT_SEARCH_URL}?q=${encodeURIComponent(trimmed)}`);

    if (!response.ok) {
      throw new Error(`Text search failed (${response.status})`);
    }

    const payload = await response.json();
    return normalizeCardsResponse(payload);
  } catch (err) {
    console.error('Card text search error', err);
    throw err;
  }
};
