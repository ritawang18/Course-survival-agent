import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isToday,
  isTomorrow,
  startOfDay,
  startOfWeek,
} from "date-fns";

export function relativeDue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return `Today · ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow · ${format(d, "h:mm a")}`;
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 1 && diff < 7) return `In ${diff} days · ${format(d, "EEE h:mm a")}`;
  if (diff < 0) return `Overdue · ${formatDistanceToNowStrict(d)} ago`;
  return format(d, "MMM d · h:mm a");
}

export function weekDays(anchor: Date = new Date()): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shortDay(d: Date) {
  return format(d, "EEE");
}

export function monthLabel(d: Date) {
  return format(d, "MMMM yyyy");
}

export function isoDay(d: Date) {
  return format(startOfDay(d), "yyyy-MM-dd");
}

export { isSameDay, addDays, format };
