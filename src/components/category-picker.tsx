import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import type { Category, TransactionType } from '@/types/transaction';
import { useColors } from '@/utils/colors';

type Props = {
  categories: Category[];
  selectedId: string | null;
  type: TransactionType;
  onSelect: (id: string) => void;
};

export function CategoryPicker({ categories, selectedId, type, onSelect }: Props) {
  const Colors = useColors();

  const [displayList, setDisplayList] = useState<Category[]>(() =>
    categories
      .filter((c) => c.type === type)
      .sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0))
  );

  // Re-sort (selected first) only when the category list or type changes, not on every tap
  useEffect(() => {
    setDisplayList(
      categories
        .filter((c) => c.type === type)
        // eslint-disable-next-line react-hooks/exhaustive-deps
        .sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0))
    );
  // selectedId intentionally excluded — only sort to front on initial load / type switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, type]);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
          CATEGORY
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/(categories)')}>
          <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      </View>

      <BottomSheetScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {displayList.map((cat) => {
          const selected = cat.id === selectedId;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onSelect(cat.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: selected ? Colors.accent : Colors.surface,
                borderWidth: selected ? 0 : 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
              <Text
                style={{
                  color: selected ? Colors.text : Colors.textSecondary,
                  fontSize: 14,
                  fontWeight: '500',
                }}
              >
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </View>
  );
}
