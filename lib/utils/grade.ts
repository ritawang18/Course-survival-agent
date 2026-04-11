import type { GradingCategory } from "@/lib/store/types";

export function weightedGrade(categories: GradingCategory[]): number {
  const active = categories.filter((c) => c.earned != null);
  if (!active.length) return 0;
  const totalWeight = active.reduce((sum, c) => sum + c.weight, 0);
  const earned = active.reduce(
    (sum, c) => sum + (c.earned! / 100) * c.weight,
    0
  );
  return totalWeight ? (earned / totalWeight) * 100 : 0;
}

export function projectedFinal(
  categories: GradingCategory[],
  assumedScore = 85
): number {
  const withFallback = categories.map((c) => ({
    ...c,
    earned: c.earned ?? assumedScore,
  }));
  return weightedGrade(withFallback);
}

export function letter(grade: number): string {
  if (grade >= 93) return "A";
  if (grade >= 90) return "A-";
  if (grade >= 87) return "B+";
  if (grade >= 83) return "B";
  if (grade >= 80) return "B-";
  if (grade >= 77) return "C+";
  if (grade >= 73) return "C";
  if (grade >= 70) return "C-";
  if (grade >= 60) return "D";
  return "F";
}

export function gpa(grade: number): number {
  if (grade >= 93) return 4.0;
  if (grade >= 90) return 3.7;
  if (grade >= 87) return 3.3;
  if (grade >= 83) return 3.0;
  if (grade >= 80) return 2.7;
  if (grade >= 77) return 2.3;
  if (grade >= 73) return 2.0;
  if (grade >= 70) return 1.7;
  if (grade >= 60) return 1.0;
  return 0;
}
