import type { AssignmentStatus, Priority } from "@/lib/store/types";

const URGENT_WITHIN_DAYS = 3;
const IMPORTANT_WITHIN_DAYS = 7;

/** Derive a Priority bucket from how close a due date is to now. */
export function priorityFromDueDate(dueAt: string | null | undefined): Priority {
  if (!dueAt) return "optional";
  const daysUntil = (new Date(dueAt).getTime() - Date.now()) / 86_400_000;
  if (daysUntil <= URGENT_WITHIN_DAYS) return "urgent";
  if (daysUntil <= IMPORTANT_WITHIN_DAYS) return "important";
  return "optional";
}

/** Same as priorityFromDueDate, but reports "done" for completed assignments. */
export function priorityOrDone(
  status: AssignmentStatus,
  dueAt: string | null | undefined
): Priority | "done" {
  if (status === "done") return "done";
  return priorityFromDueDate(dueAt);
}
