import type { ExerciseService, ExerciseServiceNewOrUpdate } from "@/generated/api/types.generated"
import { validURL } from "@/shared-module/common/utils/validation"

export const prepareExerciseServiceForBackend = (
  service: ExerciseServiceNewOrUpdate | ExerciseService,
): ExerciseServiceNewOrUpdate | ExerciseService => {
  const preparedService = {
    ...service,
    internal_url: validURL(service.internal_url ?? null) ? (service.internal_url ?? null) : null,
  }
  return preparedService
}
