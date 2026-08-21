/**
 * Zod schemas for the API request bodies. Handlers previously cast unchecked payloads, so malformed
 * input crashed deep inside tmc-langs / pod execution as 500s; these validate the full shape up
 * front (400 on failure) and give handlers inferred types instead of `as` casts. `satisfies
 * z.ZodType<...>` pins each schema to its hand-written interface so the two can't drift.
 */
import { z } from "zod"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import type { ExerciseFile, PrivateSpec } from "@/util/stateInterfaces"

// Loose objects: tolerate extra fields the backend may add, like the old casts did.
export const repositoryExerciseSchema = z.looseObject({
  id: z.string(),
  repository_id: z.string(),
  part: z.string(),
  name: z.string(),
  repository_url: z.string(),
  checksum: z.array(z.number()),
  download_url: z.string(),
}) satisfies z.ZodType<RepositoryExercise>

export const privateSpecSchema = z.looseObject({
  type: z.enum(["browser", "editor"]),
  repository_exercise: repositoryExerciseSchema,
}) satisfies z.ZodType<PrivateSpec>

export const exerciseFileSchema = z.object({
  filepath: z.string(),
  contents: z.string(),
}) satisfies z.ZodType<ExerciseFile>

/** The browser editor's files, as the iframe posts them to be packed into an archive. */
export const packBrowserAnswerRequestSchema = z.array(exerciseFileSchema).min(1)

/** One file of the graded answer. `size_bytes` is null when the host never recorded a size. */
export const gradingRequestFileSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size_bytes: z.number().nullish(),
  download_url: z.string(),
})

// submission_data is not read: a tmc answer is its archive, so the request's files are the answer.
export const gradeRequestSchema = z.looseObject({
  grading_update_url: z.string(),
  exercise_spec: privateSpecSchema,
  submission_files: z.array(gradingRequestFileSchema).min(1),
})
export type GradeRequest = z.infer<typeof gradeRequestSchema>

// SpecRequest envelope for public-spec / model-solution. private_spec is validated separately so
// handlers keep their distinct "missing private spec" error messages.
export const specRequestSchema = z.looseObject({
  request_id: z.string(),
  private_spec: z.unknown(),
  upload_url: z.string().nullable(),
})
export type ParsedSpecRequest = z.infer<typeof specRequestSchema>

export const testRequestSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("browser"),
    templateDownloadUrl: z.string(),
    files: z.array(exerciseFileSchema),
  }),
  z.looseObject({
    type: z.literal("editor"),
    templateDownloadUrl: z.string(),
    archiveDownloadUrl: z.string(),
  }),
])
export type TestRequest = z.infer<typeof testRequestSchema>

export const extractStubRequestSchema = z.looseObject({
  stub_download_url: z.string().min(1),
})
