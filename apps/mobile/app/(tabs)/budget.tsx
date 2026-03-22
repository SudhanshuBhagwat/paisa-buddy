import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { colors, spacing, typography } from '@paisa-buddy/ui';

export default function BudgetScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Budget</Text>
      <Text style={styles.placeholder}>Your budgets will appear here.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSize2xl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  placeholder: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeMd,
  },
});
