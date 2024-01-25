import { ExerciseService, ExerciseServiceNewOrUpdate } from "../shared-module/common/bindings"
import { validURL } from "../shared-module/common/utils/validation"

export const prepareExerciseServiceForBackend = (
  service: ExerciseServiceNewOrUpdate | ExerciseService,
): ExerciseServiceNewOrUpdate | ExerciseService => {
  const preparedService = {
    ...service,
    internal_url: validURL(service.internal_url) ? service.internal_url : null,
  }
  return preparedService
}
