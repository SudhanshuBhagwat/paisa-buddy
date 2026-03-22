import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { formatCurrency } from '@paisa-buddy/utils';
import { colors, spacing, typography } from '@paisa-buddy/ui';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning 👋</Text>
        <Text style={styles.title}>Paisa Buddy</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(125000)}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSizeSm,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSize2xl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
  },
  balanceLabel: {
    fontSize: typography.fontSizeSm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: typography.fontSize3xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
