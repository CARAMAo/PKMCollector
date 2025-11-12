import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardResult } from '@/types/card';

export type CollectionEntry = {
  card: CardResult;
  count: number;
};

type CardResultsContextValue = {
  results: CardResult[];
  setResults: (cards: CardResult[]) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  collection: Record<string, CollectionEntry>;
  setCardCount: (card: CardResult, count: number) => void;
  adjustCardCount: (card: CardResult, delta: number) => void;
  getCardCount: (cardId: string) => number;
  isInCollection: (cardId: string) => boolean;
  hydrated: boolean;
};

const STORAGE_KEY = '@card_collection';

const CardResultsContext = createContext<CardResultsContextValue | undefined>(undefined);

const sanitizeCount = (value: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export function CardResultsProvider({ children }: { children: React.ReactNode }) {
  const [results, setResults] = useState<CardResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collection, setCollection] = useState<Record<string, CollectionEntry>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const normalized: Record<string, CollectionEntry> = {};
            Object.entries(parsed as Record<string, any>).forEach(([key, value]) => {
              if (value && typeof value === 'object' && 'card' in value && 'count' in value) {
                normalized[key] = {
                  card: (value as CollectionEntry).card,
                  count: sanitizeCount((value as CollectionEntry).count),
                };
              } else {
                normalized[key] = { card: value as CardResult, count: 1 };
              }
            });
            setCollection(normalized);
          }
        }
      } catch (err) {
        console.warn('Unable to load collection from storage', err);
      } finally {
        setHydrated(true);
      }
    };

    hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collection)).catch((err) => {
      console.warn('Unable to persist collection', err);
    });
  }, [collection, hydrated]);

  useEffect(() => {
    if (results.length === 0) {
      setSelectedIndex(0);
      return;
    }

    if (selectedIndex > results.length - 1) {
      setSelectedIndex(results.length - 1);
    }
  }, [results, selectedIndex]);

  const setCardCount = useCallback((card: CardResult, count: number) => {
    const sanitized = sanitizeCount(count);
    setCollection((prev) => {
      const next = { ...prev };
      if (sanitized <= 0) {
        delete next[card.id];
      } else {
        next[card.id] = { card, count: sanitized };
      }
      return next;
    });
  }, []);

  const adjustCardCount = useCallback((card: CardResult, delta: number) => {
    setCollection((prev) => {
      const next = { ...prev };
      const current = prev[card.id]?.count ?? 0;
      const updated = sanitizeCount(current + delta);
      if (updated <= 0) {
        delete next[card.id];
      } else {
        next[card.id] = { card, count: updated };
      }
      return next;
    });
  }, []);

  const getCardCount = useCallback((cardId: string) => collection[cardId]?.count ?? 0, [
    collection,
  ]);

  const isInCollection = useCallback((cardId: string) => getCardCount(cardId) > 0, [
    getCardCount,
  ]);

  const value = useMemo(
    () => ({
      results,
      setResults,
      selectedIndex,
      setSelectedIndex,
      collection,
      setCardCount,
      adjustCardCount,
      getCardCount,
      isInCollection,
      hydrated,
    }),
    [
      results,
      selectedIndex,
      collection,
      hydrated,
      setCardCount,
      adjustCardCount,
      getCardCount,
      isInCollection,
    ],
  );

  return <CardResultsContext.Provider value={value}>{children}</CardResultsContext.Provider>;
}

export const useCardResults = () => {
  const ctx = useContext(CardResultsContext);
  if (!ctx) {
    throw new Error('useCardResults must be used within a CardResultsProvider');
  }

  return ctx;
};
