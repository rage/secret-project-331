import { validNumber, validURL } from "@/shared-module/common/utils/validation"

type SaveableExerciseService = {
  max_reprocessing_submissions_at_once: number
  public_url: string
}

export const canSave = (service: SaveableExerciseService) => {
  return (
    validNumber(service.max_reprocessing_submissions_at_once.toString()) &&
    service.max_reprocessing_submissions_at_once > 0 &&
    validURL(service.public_url)
  )
}
