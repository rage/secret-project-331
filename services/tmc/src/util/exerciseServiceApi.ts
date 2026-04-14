export type {
  ExerciseServiceInfoApi,
  ExerciseTaskGradingResult,
  ExerciseTaskSubmission,
  GradingProgress,
  RepositoryExercise,
  SpecRequest,
} from "@/shared-module/common/exerciseServiceTypes"

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export function isSpecRequest(
  value: unknown,
): value is import("@/shared-module/common/exerciseServiceTypes").SpecRequest {
  if (!isObject(value)) {
    return false
  }
  return (
    typeof value.request_id === "string" &&
    "private_spec" in value &&
    (typeof value.upload_url === "string" || value.upload_url === null)
  )
}
