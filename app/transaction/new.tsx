import { View, Text, Pressable, TextInput, Alert, Animated, BackHandler } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useColors } from '@/utils/colors';
import { AmountInput } from '@/components/amount-input';
import { CategoryPicker } from '@/components/category-picker';
import { ReceiptImage } from '@/components/receipt-image';
import { useCategories } from '@/hooks/use-categories';
import { saveTransaction } from '@/hooks/use-transactions';
import { getTransactionById } from '@/db/transactions';
import { generateId, nowIso } from '@/utils/dates';
import type { Transaction, TransactionType, OcrResult } from '@/types/transaction';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function NewTransaction() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!params.editId;

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['80%', '100%'], []);

  const [type, setType] = useState<TransactionType>('expense');
  const [paise, setPaise] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [originalCreatedAt, setOriginalCreatedAt] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  const { categories } = useCategories();

  function showToast(msg: string) {
    setToastMessage(msg);
    setToastKey((k) => k + 1);
  }

  function closeSheet() {
    sheetRef.current?.close();
  }

  function handleSheetChange(index: number) {
    if (index === -1) router.back();
  }

  // Intercept Android back button — animate sheet closed, then onChange(-1) fires router.back()
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    []
  );

  function handleExtracted(result: OcrResult) {
    if (result.type !== null) {
      setType(result.type);
      setCategoryId(null);
    }
    if (result.amountRupees !== null) {
      setPaise(Math.round(result.amountRupees * 100));
    }
    if (result.vendor !== null) {
      setNote(result.vendor);
    }
    if (result.date !== null) {
      const parsed = new Date(result.date);
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
  }

  useEffect(() => {
    if (params.editId) {
      getTransactionById(params.editId).then((tx) => {
        if (!tx) return;
        setType(tx.type);
        setPaise(tx.amount);
        setCategoryId(tx.categoryId);
        setNote(tx.note ?? '');
        setImageUri(tx.imageUri);
        setDate(new Date(tx.date));
        setOriginalCreatedAt(tx.createdAt);
      });
    }
  }, [params.editId]);

  useEffect(() => {
    if (!categoryId) {
      const first = categories.find((c) => c.type === type);
      if (first) setCategoryId(first.id);
    }
  }, [categories, type]);

  async function handleSave() {
    if (paise === 0) {
      Alert.alert('Enter Amount', 'Please enter an amount greater than zero.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Select Category', 'Please select a category.');
      return;
    }

    setSaving(true);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const tx: Transaction = {
      id: params.editId ?? generateId(),
      type,
      amount: paise,
      categoryId,
      note: note.trim() || undefined,
      imageUri,
      date: date.toISOString().split('T')[0],
      createdAt: originalCreatedAt ?? nowIso(),
    };

    try {
      await saveTransaction(tx);
      closeSheet();
    } catch (e) {
      setSaving(false);
      Alert.alert('Save Failed', String(e));
    }
  }

  const typeColor = type === 'expense' ? Colors.expense : Colors.income;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={0}
      onChange={handleSheetChange}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: Colors.surface }}
      handleIndicatorStyle={{ backgroundColor: Colors.textTertiary, width: 36 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, gap: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            color: Colors.text,
            fontSize: 22,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {isEdit ? 'Edit Transaction' : 'New Transaction'}
        </Text>

        {/* Expense / Income toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: Colors.surfaceRaised,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 4,
          }}
        >
          {(['expense', 'income'] as TransactionType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setType(t);
                setCategoryId(null);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: 'continuous',
                alignItems: 'center',
                backgroundColor: type === t ? (t === 'expense' ? Colors.expense : Colors.income) : 'transparent',
              }}
            >
              <Text
                style={{
                  color: type === t ? Colors.text : Colors.textSecondary,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                {t === 'expense' ? '↑ Expense' : '↓ Income'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ReceiptImage
          uri={imageUri}
          onChange={setImageUri}
          onExtracted={handleExtracted}
          onScanError={(msg) => showToast(`Scan failed: ${msg}`)}
        />

        <AmountInput paise={paise} onChange={setPaise} />

        {/* Date picker */}
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 14,
            paddingLeft: 0,
            backgroundColor: Colors.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
          }}
        >
          <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>📅</Text>
          <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '500' }}>
            {date.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}

        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          type={type}
          onSelect={setCategoryId}
        />

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={Colors.textTertiary}
          style={{
            color: Colors.text,
            fontSize: 15,
            padding: 14,
            backgroundColor: Colors.surface,
            borderRadius: 14,
            borderCurve: 'continuous',
          }}
        />
      </BottomSheetScrollView>

      {/* Button bar — fixed outside scroll */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 60,
          flexDirection: 'row',
          gap: 12,
          borderTopWidth: 1,
          borderColor: Colors.border,
          backgroundColor: Colors.surface,
        }}
      >
        <Pressable
          onPress={closeSheet}
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: Colors.surfaceRaised,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: Colors.textSecondary, fontWeight: '700', fontSize: 16 }}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => ({
            flex: 2,
            padding: 16,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: pressed || saving ? `${typeColor}99` : typeColor,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 16 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Transaction'}
          </Text>
        </Pressable>
      </View>

      <Toast toastKey={toastKey} message={toastMessage} />
    </BottomSheet>
  );
}

function Toast({ toastKey, message }: { toastKey: number; message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (toastKey === 0) return;
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
      Animated.delay(1800),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -6, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();
  }, [toastKey]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        opacity,
        transform: [{ translateY }],
        backgroundColor: '#1C1C2E',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
      }}
      pointerEvents="none"
    >
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{message}</Text>
    </Animated.View>
  );
}
