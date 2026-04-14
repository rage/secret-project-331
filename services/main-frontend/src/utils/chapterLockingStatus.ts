import type { TFunction } from "i18next"

export type TeacherChapterLockStatus = "unlocked" | "completed_and_locked" | "not_unlocked_yet"

/** Returns a translated teacher-facing lock status label. */
export function getTeacherChapterLockLabel(
  t: TFunction,
  status: TeacherChapterLockStatus | undefined,
): string {
  if (status === "completed_and_locked") {
    return t("teacher-chapter-lock-status-completed-and-locked")
  }
  if (status === "not_unlocked_yet") {
    return t("teacher-chapter-lock-status-not-unlocked-yet")
  }
  if (status === "unlocked") {
    return t("teacher-chapter-lock-status-unlocked")
  }
  return t("teacher-chapter-lock-status-no-lock-data")
}
