import { useAppStore } from '@/stores/app-store';

const SEEDED_KEY = 'demo-data-seeded';

export function seedInitialData(force = false): void {
  const alreadySeeded = localStorage.getItem(SEEDED_KEY);
  
  if (alreadySeeded && !force) {
    return;
  }

  // Mark as seeded
  localStorage.setItem(SEEDED_KEY, new Date().toISOString());
}

export function resetAndReseed(): void {
  // Clear the seeded flag
  localStorage.removeItem(SEEDED_KEY);
  
  // Reset app store
  useAppStore.getState().resetAll();
  
  // Re-seed with fresh data
  seedInitialData(true);
}
