const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Таймстемпы в БД хранятся как naive UTC (как и было на poehali.dev) — pg парсит их как UTC без смещения. */
function toMsk(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET_MS);
}

export function formatMskTime(date: Date): string {
  const d = toMsk(date);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatMskDate(date: Date): string {
  const d = toMsk(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function pythonWeekday(date: Date): number {
  return (date.getUTCDay() + 6) % 7; // JS Sun=0..Sat=6 → Python Mon=0..Sun=6
}

export function formatOnline(lastSeen: Date | null, now: Date): string | null {
  if (!lastSeen) return null;
  const seconds = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);
  const days = Math.floor(seconds / 86400);
  if (seconds < 180) return "online";
  if (seconds < 3600) return `был(а) ${Math.floor(seconds / 60)} мин назад`;
  if (seconds < 86400) return `был(а) ${Math.floor(seconds / 3600)} ч назад`;
  if (days === 1) return "был(а) вчера";
  if (days < 7) return `был(а) ${days} дн назад`;
  return `был(а) ${pad(lastSeen.getUTCDate())}.${pad(lastSeen.getUTCMonth() + 1)}`;
}

export function formatChatTime(lastAt: Date | null, now: Date): string {
  if (!lastAt) return "";
  const seconds = Math.floor((now.getTime() - lastAt.getTime()) / 1000);
  const days = Math.floor(seconds / 86400);
  if (days === 0) return `${pad(lastAt.getUTCHours())}:${pad(lastAt.getUTCMinutes())}`;
  if (days === 1) return "Вчера";
  if (days < 7) return WEEKDAYS[pythonWeekday(lastAt)];
  return `${pad(lastAt.getUTCDate())}.${pad(lastAt.getUTCMonth() + 1)}`;
}
