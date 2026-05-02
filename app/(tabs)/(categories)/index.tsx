import { View, Text, FlatList, Pressable, Alert, TextInput } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/utils/colors';
import { useCategories } from '@/hooks/use-categories';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar';
import type { TransactionType } from '@/types/transaction';

const EMOJI_OPTIONS = ['🍔', '🚗', '🛍️', '💡', '🎬', '📦', '💸', '💼', '💻', '📥', '🏥', '✈️', '🎓', '🏠', '🎮', '☕'];

export default function CategoriesScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { categories, add, update, remove } = useCategories();
  const [adding, setAdding] = useState<TransactionType | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📦');

  const expenses = categories.filter((c) => c.type === 'expense');
  const incomes = categories.filter((c) => c.type === 'income');

  async function handleAdd(type: TransactionType) {
    if (!newName.trim()) return;
    await add(newName.trim(), newEmoji, type);
    setAdding(null);
    setNewName('');
    setNewEmoji('📦');
  }

  function handleDelete(id: string, name: string, isDefault: boolean) {
    if (isDefault) {
      Alert.alert('Cannot Delete', `"${name}" is a default category and cannot be deleted.`);
      return;
    }
    Alert.alert('Delete Category', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
    <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: Colors.background }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.text }}>Categories</Text>
    </View>
    <FlatList
      data={[]}
      renderItem={null}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 24, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 48 }}
      ListHeaderComponent={
        <>
          <Section
            title="Expenses"
            categories={expenses}
            type="expense"
            adding={adding}
            newName={newName}
            newEmoji={newEmoji}
            onSetAdding={setAdding}
            onNameChange={setNewName}
            onEmojiChange={setNewEmoji}
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
          <Section
            title="Income"
            categories={incomes}
            type="income"
            adding={adding}
            newName={newName}
            newEmoji={newEmoji}
            onSetAdding={setAdding}
            onNameChange={setNewName}
            onEmojiChange={setNewEmoji}
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
        </>
      }
    />
    </View>
  );
}

type SectionProps = {
  title: string;
  categories: any[];
  type: TransactionType;
  adding: TransactionType | null;
  newName: string;
  newEmoji: string;
  onSetAdding: (t: TransactionType | null) => void;
  onNameChange: (s: string) => void;
  onEmojiChange: (s: string) => void;
  onAdd: (t: TransactionType) => void;
  onDelete: (id: string, name: string, isDefault: boolean) => void;
};

function Section({ title, categories, type, adding, newName, newEmoji, onSetAdding, onNameChange, onEmojiChange, onAdd, onDelete }: SectionProps) {
  const Colors = useColors();
  const isAddingThis = adding === type;

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
        {title.toUpperCase()}
      </Text>

      <View style={{ gap: 8 }}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onLongPress={() => onDelete(cat.id, cat.name, cat.isDefault)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              backgroundColor: Colors.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
            }}
          >
            <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
            <Text style={{ flex: 1, color: Colors.text, fontSize: 15, fontWeight: '500' }}>
              {cat.name}
            </Text>
            {cat.isDefault && (
              <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>Default</Text>
            )}
            {!cat.isDefault && (
              <Pressable onPress={() => onDelete(cat.id, cat.name, false)} hitSlop={8}>
                <Text style={{ color: Colors.destructive, fontSize: 13 }}>Delete</Text>
              </Pressable>
            )}
          </Pressable>
        ))}

        {isAddingThis && (
          <View
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {EMOJI_OPTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => onEmojiChange(e)}
                  style={{
                    padding: 4,
                    borderRadius: 8,
                    borderWidth: e === newEmoji ? 2 : 0,
                    borderColor: Colors.accent,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={newName}
              onChangeText={onNameChange}
              placeholder="Category name"
              placeholderTextColor={Colors.textTertiary}
              style={{
                color: Colors.text,
                fontSize: 16,
                borderBottomWidth: 1,
                borderColor: Colors.border,
                paddingVertical: 8,
              }}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => onSetAdding(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.surfaceRaised, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => onAdd(type)}
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.text, fontWeight: '600' }}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!isAddingThis && (
          <Pressable
            onPress={() => { onSetAdding(type); onNameChange(''); onEmojiChange('📦'); }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 14,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: pressed ? Colors.accent : Colors.border,
            })}
          >
            <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '700' }}>+</Text>
            <Text style={{ color: Colors.accent, fontSize: 14, fontWeight: '600' }}>
              Add {title} Category
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
