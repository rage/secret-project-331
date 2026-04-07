import { client as generatedApiClient } from "@/generated/api/client.generated"
import {
  createCourseGlossaryTerm,
  deleteGlossaryTerm,
  getCourseGlossary,
  updateGlossaryTerm,
} from "@/generated/api/sdk.generated"
import type { Term, TermUpdate } from "@/generated/api/types.generated"

export type ApiGlossaryTerm = Term
export type ApiGlossaryTermUpdate = TermUpdate

export const fetchGlossaryFromApi = async (courseId: string): Promise<Term[]> => {
  return getCourseGlossary({
    client: generatedApiClient,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const createGlossaryTerm = async (courseId: string, update: TermUpdate): Promise<string> => {
  return createCourseGlossaryTerm({
    body: update,
    client: generatedApiClient,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })
}

export const updateGlossaryTermById = async (termId: string, update: TermUpdate): Promise<void> => {
  await updateGlossaryTerm({
    body: update,
    client: generatedApiClient,
    path: {
      term_id: termId,
    },
    throwOnError: true,
  })
}

export const deleteGlossaryTermById = async (termId: string): Promise<void> => {
  await deleteGlossaryTerm({
    client: generatedApiClient,
    path: {
      term_id: termId,
    },
    throwOnError: true,
  })
}
