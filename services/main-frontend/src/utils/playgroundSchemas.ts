import { z } from "zod"

import { zGradingProgress } from "@/generated/api/zod.generated"

export const zExerciseServiceInfoApi = z.object({
  service_name: z.string(),
  user_interface_iframe_path: z.string(),
  grade_endpoint_path: z.string(),
  public_spec_endpoint_path: z.string(),
  model_solution_spec_endpoint_path: z.string(),
  has_custom_view: z.boolean().optional(),
  csv_export_definitions_endpoint_path: z.string().optional(),
  csv_export_answers_endpoint_path: z.string().optional(),
})

export type ExerciseServiceInfoApi = z.infer<typeof zExerciseServiceInfoApi>

export const zExerciseTaskGradingResult = z.object({
  grading_progress: zGradingProgress,
  score_given: z.number(),
  score_maximum: z.number().int(),
  feedback_text: z.string().nullable(),
  feedback_json: z.unknown().nullable(),
  set_user_variables: z.record(z.string(), z.unknown()).optional(),
})

export type ExerciseTaskGradingResult = z.infer<typeof zExerciseTaskGradingResult>

export const zSpecRequest = z.object({
  request_id: z.string().uuid(),
  private_spec: z.unknown(),
  upload_url: z.string().url(),
})

export type SpecRequest = z.infer<typeof zSpecRequest>

export const zRepositoryExercise = z.object({
  id: z.string(),
  repository_id: z.string(),
  part: z.string(),
  name: z.string(),
  repository_url: z.string().url(),
  checksum: z.array(z.number().int()),
  download_url: z.string().url(),
})

export type RepositoryExercise = z.infer<typeof zRepositoryExercise>

export const zPlaygroundViewsMessage = z.discriminatedUnion("tag", [
  z.object({
    tag: z.literal("TimedOut"),
  }),
  z.object({
    tag: z.literal("Registered"),
    data: z.string().uuid(),
  }),
  z.object({
    tag: z.literal("ExerciseTaskGradingResult"),
    data: zExerciseTaskGradingResult,
  }),
])

export type PlaygroundViewsMessage = z.infer<typeof zPlaygroundViewsMessage>

export const parseExerciseServiceInfoApi = (value: unknown): ExerciseServiceInfoApi =>
  zExerciseServiceInfoApi.parse(value)

export const parseExerciseTaskGradingResult = (value: unknown): ExerciseTaskGradingResult =>
  zExerciseTaskGradingResult.parse(value)

export const parsePlaygroundViewsMessage = (value: unknown): PlaygroundViewsMessage =>
  zPlaygroundViewsMessage.parse(value)
