import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type RepositoryExercise } from "@/generated/api"
import { z } from "@/generated/api/zod"
import { zRepositoryExercise } from "@/generated/api/zod.generated"

export const getRepositoryExercises = async (
  courseId: string,
): Promise<Array<RepositoryExercise>> => {
  const response = await cmsClient.get(`/repository-exercises/${courseId}`)
  return parseCmsResponse(response, z.array(zRepositoryExercise))
}
