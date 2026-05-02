import { Redirect } from 'expo-router';
import { useOnboarding } from '@/hooks/use-onboarding';

export default function Index() {
  const { hasOnboarded } = useOnboarding();
  if (hasOnboarded) {
    return <Redirect href="/(tabs)/(home)" />;
  }
  return <Redirect href="/onboarding" />;
}
