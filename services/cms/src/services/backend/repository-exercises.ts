import { cmsClient } from "./cmsClient"

import { RepositoryExercise } from "@/shared-module/common/bindings"
import { isRepositoryExercise } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const getRepositoryExercises = async (
  courseId: string,
): Promise<Array<RepositoryExercise>> => {
  const response = await cmsClient.get(`/repository-exercises/${courseId}`)
  return validateResponse(response, isArray(isRepositoryExercise))
}
