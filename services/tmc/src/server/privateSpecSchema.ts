import { z } from "zod"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import type { PrivateSpecSchemaResponse } from "@/shared-module/exercise-protocol/core/exerciseServiceTypes"
import { jsonOk } from "@/util/apiResponse"

import { privateSpecSchema } from "./requestSchemas"

const repositoryExercise = {
  id: "00000000-0000-0000-0000-000000000001",
  repository_id: "00000000-0000-0000-0000-000000000002",
  part: "part01",
  name: "part01-01_example",
  repository_url: "https://example.com/course-repository.git",
  checksum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  download_url: "https://example.com/files/part01-01_example.tar.zst",
  details: { plugin: "python3" },
}

// "input" io: the served schema describes what the endpoints accept. Not made strict, because
// stored specs carry repository_exercise fields (like `details`) the schema does not name.
const response: PrivateSpecSchemaResponse = {
  schema: z.toJSONSchema(privateSpecSchema, { io: "input" }),
  examples: [
    { type: "editor", repository_exercise: repositoryExercise },
    { type: "browser", repository_exercise: repositoryExercise },
  ],
  notes:
    'Prefer the patch_exercise_tasks "link_repository_exercise" op, which builds the spec from a repository exercise, over writing repository_exercise by hand. "browser" only works for python3 exercises. Keys the schema does not name are ignored.',
}

function getImpl() {
  return jsonOk<PrivateSpecSchemaResponse>(response)
}

export const handlePrivateSpecSchema = wrapRouteHandler(getImpl, {
  service: "tmc",
  operation: "GET /private-spec-schema",
})
