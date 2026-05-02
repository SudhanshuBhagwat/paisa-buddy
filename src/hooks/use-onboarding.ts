import { useSyncExternalStore } from 'react';
import { storage } from '@/utils/storage';

const ONBOARDING_KEY = 'hasOnboarded';
const USER_NAME_KEY = 'userName';

export function useOnboarding() {
  const hasOnboarded = useSyncExternalStore(
    (cb) => storage.subscribe(ONBOARDING_KEY, cb),
    () => storage.get<boolean>(ONBOARDING_KEY, false)
  );

  function completeOnboarding(name?: string) {
    if (name?.trim()) storage.set(USER_NAME_KEY, name.trim());
    storage.set(ONBOARDING_KEY, true);
  }

  return { hasOnboarded, completeOnboarding };
}

export function useUserName() {
  const name = useSyncExternalStore(
    (cb) => storage.subscribe(USER_NAME_KEY, cb),
    () => storage.get<string>(USER_NAME_KEY, '')
  );

  function setName(value: string) {
    storage.set(USER_NAME_KEY, value.trim());
  }

  return { name, setName };
}
