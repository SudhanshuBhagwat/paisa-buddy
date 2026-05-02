export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

export function prevMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return monthKey(date);
}

export function nextMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month, 1);
  return monthKey(date);
}

export function isFutureMonth(key: string): boolean {
  return key > currentMonthKey();
}

export function dateLabel(isoDate: string): string {
  const today = todayIso();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (isoDate === today) return 'Today';
  if (isoDate === yesterdayStr) return 'Yesterday';

  return new Date(isoDate).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
