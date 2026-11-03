import { isAppApiError } from "@/shared-module/common/errors/AppApiError"

/** Whether a save was refused because the saved version changed after the editor loaded it. */
export const isStaleVersionError = (error: unknown): boolean =>
  isAppApiError(error) && error.messageKey === "stale_version"
