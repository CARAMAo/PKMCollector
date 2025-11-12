import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import CardScanner from '@/components/CardScanner';
import { CardResult } from '@/types/card';
import { useCardResults } from '@/context/CardResultsContext';

export default function ScanScreen() {
  const router = useRouter();
  const { setResults, setSelectedIndex } = useCardResults();
  const [error, setError] = useState<string | null>(null);

  const handleCardsRecognized = (cards: CardResult[]) => {
    if (!cards.length) {
      setError('No cards recognized.');
      return;
    }

    setResults(cards);
    setSelectedIndex(0);
    setError(null);
    router.push('/card_modal');
  };

  const handleError = () => {
    setError('Something went wrong while recognizing the card.');
  };

  return (
    <View style={styles.container}>
      <CardScanner onCardsRecognized={handleCardsRecognized} onError={handleError} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  error: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    color: '#ff7a7a',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
