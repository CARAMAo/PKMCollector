import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useCardResults } from '@/context/CardResultsContext';
import { CardResult } from '@/types/card';
import { searchCards } from '@/services/searchCards';

export default function SearchScreen() {
  const router = useRouter();
  const { setResults, setSelectedIndex, adjustCardCount } = useCardResults();
  const [query, setQuery] = useState('');
  const [results, setLocalResults] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const requestRef = useRef(0);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = (text: string) => {
    const trimmed = text.trim();

    if (!trimmed) {
      setLocalResults([]);
      setResults([]);
      setError(null);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);
    const currentRequest = Date.now();
    requestRef.current = currentRequest;

    searchCards(trimmed)
      .then((cards) => {
        if (requestRef.current !== currentRequest) return;
        setLocalResults(cards);
        setResults(cards);
      })
      .catch(() => {
        if (requestRef.current !== currentRequest) return;
        setError('Unable to complete the search.');
      })
      .finally(() => {
        if (requestRef.current === currentRequest) {
          setLoading(false);
        }
      });
  };

  const handleOpenDetails = (index: number) => {
    const current = results[index];
    const prev = results[index - 1];
    const next = results[index + 1];
    if (current?.image) Image.prefetch(current.image);
    if (prev?.image) Image.prefetch(prev.image);
    if (next?.image) Image.prefetch(next.image);
    setSelectedIndex(index);
    router.push('/card_modal');
  };

  const handleAddToCollection = (card: CardResult) => {
    adjustCardCount(card, 1);
    // ephemeral toast
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast('Added to collection');
    toastTimerRef.current = setTimeout(() => setToast(null), 1200);
  };

  const renderItem = ({ item, index }: { item: CardResult; index: number }) => {
    const imageSource = item.image ? { uri: item.image } : null;

    return (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.85}
        onPress={() => handleOpenDetails(index)}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.thumbnailPlaceholder]}>
            <Ionicons name="image" size={24} color="rgba(255,255,255,0.4)" />
          </View>
        )}
        <View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        {item.set?.name && (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.set.name}
          </Text>
        )}
        </View>
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 10, right: 10 }}
          onPress={() => handleAddToCollection(item)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="add-circle" size={32} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const listEmptyComponent = () => {
    if (!hasSearched) {
      return <Text style={styles.emptyText}>Type a query and press Search.</Text>;
    }

    if (loading) {
      return null;
    }

    return <Text style={styles.emptyText}>No results found.</Text>;
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color="rgba(255,255,255,0.8)" />
        <TextInput
          style={styles.input}
          placeholder="Search a card..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={query}
          clearButtonMode='always'
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query)}
        />
        {loading && <ActivityIndicator size="small" color="#ffffff" style={styles.loading} />}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={listEmptyComponent}
        keyboardShouldPersistTaps="handled"
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
      />
      {toast && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', padding: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 44,
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
  },
  loading: {
    marginLeft: 8,
  },
  listContent: {
    paddingTop: 24,
    paddingBottom: 120,
  },
  gridRow: {
    gap: 8,
    display: 'flex',
    gridTemplateColumns: '50% 50%',
  },
  gridItem: {
    flex:.5,
    backgroundColor: '#1f1f1f',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 63 / 88,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontSize: 13,
  },
  error: {
    color: '#ff7a7a',
    marginTop: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 15,
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
