import { View, Text, Pressable, Alert, Modal } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useColors } from '@/utils/colors';
import { generateId } from '@/utils/dates';
import { useState } from 'react';

type Props = {
  uri?: string;
  onChange: (uri: string | undefined) => void;
};

export function ReceiptImage({ uri, onChange }: Props) {
  const Colors = useColors();
  const [preview, setPreview] = useState(false);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const dest = `${FileSystem.documentDirectory}receipts/${generateId()}.jpg`;
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}receipts/`, {
      intermediates: true,
    });
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    onChange(dest);
  }

  function removeImage() {
    Alert.alert('Remove Receipt', 'Remove the receipt image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(undefined) },
    ]);
  }

  if (uri) {
    return (
      <>
        <Pressable onPress={() => setPreview(true)} onLongPress={removeImage}>
          <View style={{ borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }}>
            <Image
              source={{ uri }}
              style={{ width: '100%', height: 140 }}
              contentFit="cover"
            />
          </View>
        </Pressable>

        <Modal visible={preview} transparent animationType="fade">
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' }}
            onPress={() => setPreview(false)}
          >
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '60%' }}
              contentFit="contain"
            />
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <Pressable
      onPress={pick}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: pressed ? Colors.accent : Colors.border,
        backgroundColor: pressed ? `${Colors.accent}11` : 'transparent',
      })}
    >
      <Text style={{ fontSize: 20 }}>🧾</Text>
      <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '500' }}>
        Add Receipt Image
      </Text>
    </Pressable>
  );
}
