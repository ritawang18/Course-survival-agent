import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

// Anchor to "now" at module load. Mock dates are relative so the app always looks current.
const NOW = new Date();

export function at(daysFromNow: number, hours = 9, minutes = 0): string {
  const base = startOfDay(addDays(NOW, daysFromNow));
  return setMinutes(setHours(base, hours), minutes).toISOString();
}

export function day(daysFromNow: number): string {
  return startOfDay(addDays(NOW, daysFromNow)).toISOString();
}

export const TODAY = NOW;
