import React, { useMemo } from 'react';
import {
  View,
  SectionList,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  SectionListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { CollectionEntry, useCardResults } from '@/context/CardResultsContext';
import { CardResult } from '@/types/card';
import { BlurView } from 'expo-blur';

const UNKNOWN_SET = 'Unknown Set';

type Section = {
  title: string;
  data: CollectionEntry[];
};

export default function CollectionScreen() {
  const router = useRouter();
  const { collection, setResults, setSelectedIndex } = useCardResults();

  const entries = useMemo(() => Object.values(collection), [collection]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const setA = a.card.set?.name ?? UNKNOWN_SET;
      const setB = b.card.set?.name ?? UNKNOWN_SET;

      if (setA === setB) {
        return a.card.name.localeCompare(b.card.name);
      }

      return setA.localeCompare(setB);
    });
  }, [entries]);

  const sections = useMemo<Section[]>(() => {
    if (!sortedEntries.length) return [];

    const grouped = new Map<string, CollectionEntry[]>();

    sortedEntries.forEach((entry) => {
      const key = entry.card.set?.name ?? UNKNOWN_SET;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(entry);
    });

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [sortedEntries]);

  const indexMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedEntries.forEach((entry, index) => map.set(entry.card.id, index));
    return map;
  }, [sortedEntries]);

  const handleOpenDetails = (card: CardResult) => {
    const index = indexMap.get(card.id) ?? 0;
    const cards = sortedEntries.map((entry) => entry.card);
    // Prefetch current and neighbors
    const curr = cards[index]?.image;
    const prev = cards[index - 1]?.image;
    const next = cards[index + 1]?.image;
    if (curr) Image.prefetch(curr);
    if (prev) Image.prefetch(prev);
    if (next) Image.prefetch(next);
    setResults(cards);
    setSelectedIndex(index);
    router.push('/card_modal');
  };

  const renderItem = ({ item, index, section }: SectionListRenderItemInfo<CollectionEntry, Section>) => {
    // Build rows with 2 tiles: render only on even indices, skip odd ones
    if (index % 2 !== 0) return null;

    const first = section.data[index];
    const second = section.data[index + 1];

    const Tile = ({ entry }: { entry?: CollectionEntry }) => {
      if (!entry) {
        return <View style={[styles.gridItem, styles.gridItemEmpty]} />;
      }
      const card = entry.card;
      const imageSource = card.image ? { uri: card.image } : null;
      return (
        <TouchableOpacity
          style={styles.gridItem}
          activeOpacity={0.85}
          onPress={() => handleOpenDetails(card)}
        >
          <View style={styles.gridImageWrapper}>
            {imageSource ? (
              <Image source={imageSource} style={styles.gridImage} />
            ) : (
              <View style={[styles.gridImage, styles.imagePlaceholder]}>
                <Text style={styles.imageFallback}>No image</Text>
              </View>
            )}
            <View style={styles.gridCountBadge}>
              <Text style={styles.gridCountBadgeText}>{entry.count}</Text>
            </View>
          </View>
          <Text style={styles.gridCardName} numberOfLines={1}>
            {card.name}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.gridRow}>
        <Tile entry={first} />
        <Tile entry={second} />
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <>
    
    <Image src={section.data[0].card.set?.logo||''} style={{width:100, height:50, alignSelf:'center'}} />
    <Text style={styles.sectionHeader}>{section.title}</Text>
    </>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.card.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        style={{ flex: 1 }}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={
          sections.length === 0 ? styles.emptyContentContainer : styles.contentContainer
        }
        // grid rows have internal spacing; no extra item separator
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your collection is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add cards from the search tab or by scanning them to see them organized here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  contentContainer: { padding: 16, paddingBottom: 120 },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  sectionHeader: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 14,
    padding: 8,
  },
  gridItemEmpty: {
    backgroundColor: 'transparent',
  },
  gridImageWrapper: { position: 'relative' },
  gridImage: {
    width: '100%',
    aspectRatio: 63 / 88,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFallback: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  gridCardName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  gridCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#ffcd3c',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  gridCountBadgeText: {
    color: '#0b0b0b',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionSeparator: { height: 8 },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
