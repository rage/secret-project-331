import { ExerciseServiceNewOrUpdate } from "../shared-module/common/bindings"
import { validNumber, validURL } from "../shared-module/common/utils/validation"

export const canSave = (service: ExerciseServiceNewOrUpdate) => {
  return (
    validNumber(service.max_reprocessing_submissions_at_once.toString()) &&
    service.max_reprocessing_submissions_at_once > 0 &&
    validURL(service.public_url)
  )
}
