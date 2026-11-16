import type { ExamRequirement } from "@/generated/api/types.generated"

/** Whether the exam is held where this platform can't see its results: Examinarium or elsewhere. */
export const isOutsidePlatform = (exam: ExamRequirement): boolean =>
  exam === "examinarium" || exam === "elsewhere"
