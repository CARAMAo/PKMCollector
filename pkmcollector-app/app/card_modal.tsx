import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TCGPLAYER_LOGO from '../assets/images/TCGplayer_Logo.png';

import { CardResult, CardPricing, PricingVariantType } from '@/types/card';
import { useCardResults } from '@/context/CardResultsContext';
import { fetchCardPricing } from '@/services/fetchCardPricing';

const { width, height } = Dimensions.get('window');

const formatVariantLabel = (variant: string) =>
  variant
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

type PricingState = {
  loading: boolean;
  data?: CardPricing | null;
  error?: string;
};

export default function CardDetailModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    results,
    selectedIndex,
    setSelectedIndex,
    setCardCount,
    getCardCount,
  } = useCardResults();
  const listRef = useRef<FlatList<CardResult>>(null);
  const fetchedPricingIds = useRef<Set<string>>(new Set());
  const [pricingMap, setPricingMap] = useState<Record<string, PricingState>>({});
  const [variantSelection, setVariantSelection] = useState<Record<string, PricingVariantType>>({});
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});

  // Prefetch current and adjacent images to reduce first-open flicker
  useEffect(() => {
    if (!results.length) return;
    const urls: string[] = [];
    const curr = results[selectedIndex]?.image;
    const prev = results[selectedIndex - 1]?.image;
    const next = results[selectedIndex + 1]?.image;
    if (curr) urls.push(curr);
    if (prev) urls.push(prev);
    if (next) urls.push(next);
    urls.forEach((u) => Image.prefetch(u));
  }, [results, selectedIndex]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (index !== selectedIndex) {
      setSelectedIndex(index);
    }
  };

  const loadPricing = useCallback(
    async (cardId: string) => {
      if (!cardId) return;

      setPricingMap((prev) => ({
        ...prev,
        [cardId]: { ...(prev[cardId] ?? {}), loading: true, error: undefined },
      }));

      try {
        const pricing = await fetchCardPricing(cardId);
        setPricingMap((prev) => ({
          ...prev,
          [cardId]: { loading: false, data: pricing ?? null },
        }));
      } catch (err) {
        console.warn('Pricing fetch failed', err);
        setPricingMap((prev) => ({
          ...prev,
          [cardId]: { loading: false, error: 'Unable to load pricing.' },
        }));
        fetchedPricingIds.current.delete(cardId);
      }
    },
    [],
  );

  useEffect(() => {
    const currentCard = results[selectedIndex];
    if (!currentCard) return;
    if (fetchedPricingIds.current.has(currentCard.id)) return;
    fetchedPricingIds.current.add(currentCard.id);
    loadPricing(currentCard.id);
  }, [results, selectedIndex, loadPricing]);

  useEffect(() => {
    setCountInputs((prev) => {
      let changed = false;
      const next = { ...prev };

      results.forEach((card) => {
        const desired = String(getCardCount(card.id));
        if (next[card.id] !== desired) {
          next[card.id] = desired;
          changed = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!results.find((card) => card.id === key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [results, getCardCount]);

  const handleCountInputChange = useCallback(
    (card: CardResult, value: string) => {
      const sanitized = value.replace(/[^0-9]/g, '');
      setCountInputs((prev) => ({ ...prev, [card.id]: sanitized }));

      const nextValue = sanitized === '' ? 0 : parseInt(sanitized, 10);
      if (Number.isNaN(nextValue)) {
        setCardCount(card, 0);
      } else {
        setCardCount(card, nextValue);
      }
    },
    [setCardCount],
  );

  const handleCountStep = useCallback(
    (card: CardResult, delta: number) => {
      const current = getCardCount(card.id);
      const next = Math.max(0, current + delta);
      setCardCount(card, next);
      setCountInputs((prev) => ({ ...prev, [card.id]: String(next) }));
    },
    [getCardCount, setCardCount],
  );

  const renderItem = ({ item }: { item: CardResult }) => {
    const imageSource = item.image ? { uri: item.image } : null;
    const count = getCardCount(item.id);
    const inCollection = count > 0;
    const displayCount = countInputs[item.id] ?? String(count);
    const pricingState = pricingMap[item.id];
    const availableVariants = pricingState?.data
      ? (Object.keys(pricingState.data.variants) as PricingVariantType[])
      : [];
    const resolvedVariant =
      variantSelection[item.id] && availableVariants.includes(variantSelection[item.id])
        ? variantSelection[item.id]
        : availableVariants[0];
    const variantData = resolvedVariant ? pricingState?.data?.variants[resolvedVariant] : undefined;
    const priceRows = [
      { label: 'Low', value: variantData?.lowPrice },
      { label: 'Mid', value: variantData?.midPrice },
      { label: 'High', value: variantData?.highPrice },
      { label: 'Market', value: variantData?.marketPrice },
      { label: 'Direct Low', value: variantData?.directLowPrice },
    ];
    const pricedRows = priceRows.filter((row) => typeof row.value === 'number');
    const metadata = [
      { label: 'Set', value: item.set?.name },
      { label: 'Rarity', value: item.rarity },
      { label: 'Category', value: item.category },
      { label: 'Illustrator', value: item.illustrator },
      { label: '#', value: item.localId },
    ].filter((row) => !!row.value);

    const variants = item.variants
      ? Object.entries(item.variants)
          .filter(([, value]) => value !== undefined && value !== null && value !== false)
          .map(([key, value]) =>
            typeof value === 'boolean' ? key : `${key}: ${String(value)}`,
          )
      : [];

    return (
      <ScrollView
        style={{ width }}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageWrapper}>
          {imageSource ? (
            <Image source={imageSource} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name='image-outline' size={36} color='rgba(255,255,255,0.4)' />
            </View>
          )}
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {!!item.set?.logo && (
              <Image source={{ uri: item.set.logo }} style={styles.setLogo} resizeMode="contain" />
            )}
          </View>
          {!!item.set?.name && (
            <View style={styles.setRow}>
              {item.set?.symbol && (
                <Image source={{ uri: item.set.symbol }} style={styles.setSymbol} />
              )}
              <Text style={styles.cardSubtitle}>{item.set.name}</Text>
            </View>
          )}
          {!!item.description && <Text style={styles.description}>{item.description}</Text>}

          <View style={styles.collectionSection}>
            <View style={styles.quantityHeader}>
              <Text style={styles.collectionLabel}>Collection</Text>
              {inCollection && <Text style={styles.quantitySaved}>{count} copies saved</Text>}
            </View>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  count <= 0 && styles.quantityButtonDisabled,
                ]}
                onPress={() => handleCountStep(item, -1)}
                disabled={count <= 0}
              >
                <Ionicons
                  name="remove"
                  size={16}
                  color={count <= 0 ? 'rgba(255,255,255,0.4)' : 'white'}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                keyboardType="number-pad"
                value={displayCount}
                onChangeText={(text) => handleCountInputChange(item, text)}
                maxLength={3}
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity style={styles.quantityButton} onPress={() => handleCountStep(item, 1)}>
                <Ionicons name="add" size={16} color="white" />
              </TouchableOpacity>
            </View>
            {!inCollection && <Text style={styles.quantityHint}>Not in your collection yet</Text>}
          </View>

          <View style={styles.metaSection}>
            {metadata.map((row) => (
              <View key={row.label} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{row.label}</Text>
                <Text style={styles.metaValue}>{String(row.value)}</Text>
              </View>
            ))}

            {!!variants.length && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Variants</Text>
                <Text style={styles.metaValue}>{variants.join(', ')}</Text>
              </View>
            )}
          </View>

          <View style={styles.pricingSection}>
            <View style={styles.pricingHeader}>
              <Text style={styles.pricingTitle}>Prices</Text>
              <Image source={TCGPLAYER_LOGO} style={styles.pricingLogo} resizeMode="contain" />
            </View>

            {availableVariants.length > 1 && (
              <View style={styles.variantSwitcher}>
                {availableVariants.map((variant) => (
                  <TouchableOpacity
                    key={variant}
                    style={[
                      styles.variantButton,
                      resolvedVariant === variant && styles.variantButtonActive,
                    ]}
                    onPress={() =>
                      setVariantSelection((prev) => ({
                        ...prev,
                        [item.id]: variant,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.variantButtonLabel,
                        resolvedVariant === variant && styles.variantButtonLabelActive,
                      ]}
                    >
                      {formatVariantLabel(variant)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {pricingState?.loading && (
              <Text style={styles.pricingMessage}>Loading pricing...</Text>
            )}

            {pricingState?.error && (
              <View style={styles.pricingErrorRow}>
                <Text style={styles.pricingError}>{pricingState.error}</Text>
                <TouchableOpacity onPress={() => loadPricing(item.id)}>
                  <Text style={styles.retry}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!pricingState?.loading && !variantData && !pricingState?.error && (
              <Text style={styles.pricingMessage}>N/A</Text>
            )}

            {!!variantData && (
              <View style={styles.priceRows}>
                {pricedRows.length > 0 ? (
                  pricedRows.map((row) => (
                    <View key={row.label} style={styles.priceRow}>
                      <Text style={styles.metaLabel}>{row.label}</Text>
                      <Text style={styles.metaValue}>
                        {variantData.currency} {row.value?.toFixed(2)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.pricingMessage}>N/A</Text>
                )}
              </View>
            )}

            {!!pricingState?.data?.updated && (
              <Text style={styles.pricingTimestamp}>
                Updated {new Date(pricingState.data.updated).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  if (!results.length) {
    return (
      <View style={styles.container}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={[styles.close, { top: insets.top + 8 }]} onPress={router.back}>
          <Ionicons name="chevron-down" size={32} color="white" />
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No cards available</Text>
          <Text style={styles.emptySubtitle}>
            Search or scan again to see card details here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <TouchableOpacity style={[styles.close, { top: insets.top + 8 }]} onPress={router.back}>
        <Ionicons name="chevron-down" size={32} color="white" />
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={results}
        horizontal
        pagingEnabled
        initialScrollIndex={selectedIndex}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        initialNumToRender={1}
        windowSize={3}
        onMomentumScrollEnd={handleMomentumEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  close: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    borderRadius: 20,
  },
  pageContent: {
    paddingTop: 40,
    paddingBottom: 80,
    alignItems: 'center',
  },
  imageWrapper: {
    width: width * 0.8,
    height: height * 0.5,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginBottom: 24,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsCard: {
    width: width * 0.85,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setLogo: {
    width: 100,
    height: 28,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  setSymbol: {
    width: 28,
    height: 28,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  description: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
    lineHeight: 20,
  },
  collectionSection: {
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  collectionLabel: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  quantityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantitySaved: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quantityInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  quantityHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  metaSection: {
    marginTop: 20,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  metaValue: {
    color: 'white',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  pricingSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pricingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pricingLogo: {
    width: 100,
    height: 28,
        backgroundColor:'white',
      borderRadius:4,
      padding:3
  },
  variantSwitcher: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  variantButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  variantButtonActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  variantButtonLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 12,
  },
  variantButtonLabelActive: {
    color: '#0b0b0b',
  },
  pricingMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  priceRows: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pricingTimestamp: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },
  pricingErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pricingError: {
    color: '#ff9898',
    fontSize: 13,
  },
  retry: {
    color: 'white',
    textDecorationLine: 'underline',
    fontSize: 13,
    fontWeight: '600',
  },
});
