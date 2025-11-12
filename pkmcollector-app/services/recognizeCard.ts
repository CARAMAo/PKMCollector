import { CardResult } from '@/types/card';
import { normalizeCardsResponse } from '@/utils/cardNormalization';

const FUNCTION_URL = 'https://functions-pkmcollector.azurewebsites.net/api/image-search';

export default async function recognizeCard(imagePath: string): Promise<CardResult[]> {
  try {
    const form = new FormData();

    form.append('image', {
      uri: imagePath,
      name: 'card.jpg',
      type: 'image/jpeg',
    } as any);

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Image search failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    return normalizeCardsResponse(payload);
  } catch (err) {
    console.error('Errore invio immagine:', err);
    throw err;
  }
}
