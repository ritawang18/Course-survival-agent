import type { CourseColor } from "@/lib/store/types";

export const courseColorMap: Record<
  CourseColor,
  {
    bg: string;
    softBg: string;
    text: string;
    stripe: string;
    ring: string;
  }
> = {
  indigo: {
    bg: "bg-indigo-500",
    softBg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    stripe: "from-indigo-500/70 to-indigo-400/20",
    ring: "ring-indigo-500/30",
  },
  emerald: {
    bg: "bg-emerald-500",
    softBg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    stripe: "from-emerald-500/70 to-emerald-400/20",
    ring: "ring-emerald-500/30",
  },
  amber: {
    bg: "bg-amber-500",
    softBg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    stripe: "from-amber-500/70 to-amber-400/20",
    ring: "ring-amber-500/30",
  },
  rose: {
    bg: "bg-rose-500",
    softBg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    stripe: "from-rose-500/70 to-rose-400/20",
    ring: "ring-rose-500/30",
  },
  sky: {
    bg: "bg-sky-500",
    softBg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    stripe: "from-sky-500/70 to-sky-400/20",
    ring: "ring-sky-500/30",
  },
  violet: {
    bg: "bg-violet-500",
    softBg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    stripe: "from-violet-500/70 to-violet-400/20",
    ring: "ring-violet-500/30",
  },
};
