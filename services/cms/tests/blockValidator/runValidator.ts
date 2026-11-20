import {
  callBlockValidator,
  isBlockValidatorReady,
  startBlockValidator,
  stopBlockValidator,
} from "@/blockValidator/validatorWorker"
import type { ValidateBlocksResponse, ValidationOutcome } from "@/generated/api/types.generated"

export const waitUntilReady = async (): Promise<void> => {
  while (!isBlockValidatorReady()) {
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
  }
}

/** Starts the worker bundle the Jest global setup built. */
export const startBuiltValidator = async (): Promise<void> => {
  const bundle = process.env.BUILT_BLOCK_VALIDATOR_PATH
  if (!bundle) {
    throw new Error("No validator bundle: the block-validator-bundle Jest project builds it.")
  }
  process.env.BLOCK_VALIDATOR_WORKER_PATH = bundle
  startBlockValidator()
  await waitUntilReady()
}

export { stopBlockValidator }

export interface TestBlock {
  clientId: string
  name: string
  isValid?: boolean
  attributes: Record<string, unknown>
  innerBlocks: TestBlock[]
}

export type ValidationBody = Omit<ValidationOutcome, "blocks"> & { blocks: TestBlock[] }

let clientIdCounter = 0

/** A block in stored form; inner blocks get their own client ids. */
export const block = (
  name: string,
  attributes: Record<string, unknown> = {},
  innerBlocks: TestBlock[] = [],
): TestBlock => ({
  clientId: `00000000-0000-4000-8000-${String(++clientIdCounter).padStart(12, "0")}`,
  name,
  isValid: true,
  attributes,
  innerBlocks,
})

/** Every course feature off, as in a request for a course without them. */
export const NO_COURSE_FEATURES = { chapter_locking_enabled: false, can_add_chatbot: false }

/** Validates one page; `page` adds to the page's request, `features` turns course features on. */
export const validate = async (
  blocks: unknown[],
  pageType = "course-page",
  page: Record<string, unknown> = {},
  features: Record<string, unknown> = {},
): Promise<ValidationBody> => {
  const response = await callBlockValidator({
    kind: "validate",
    body: {
      pages: [{ page_type: pageType, blocks, ...page }],
      course_features: { ...NO_COURSE_FEATURES, ...features },
    },
  })
  if (response.status !== 200) {
    throw new Error(`validator answered ${response.status}: ${JSON.stringify(response.body)}`)
  }
  const [validated] = (response.body as ValidateBlocksResponse).pages
  return validated as ValidationBody
}

/** Validates blocks as the children of an exercise block, `context` being the request's `exercise_context`. */
export const validateInExercise = (
  blocks: unknown[],
  context: "task_instructions" | "review_instructions",
): Promise<ValidationBody> =>
  validate(blocks, undefined, { page_type: undefined, exercise_context: context })
