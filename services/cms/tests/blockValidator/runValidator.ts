import { execFileSync } from "child_process"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import path from "path"

import {
  callBlockValidator,
  isBlockValidatorReady,
  startBlockValidator,
  stopBlockValidator,
} from "@/blockValidator/validatorWorker"

const CMS_ROOT = path.join(import.meta.dirname, "..", "..")

/** Builds the production worker bundle and starts it, so tests exercise what ships. */
export const startBuiltValidator = async (): Promise<void> => {
  const outfile = path.join(mkdtempSync(path.join(tmpdir(), "block-validator-")), "worker.cjs")
  execFileSync(
    process.execPath,
    [path.join(CMS_ROOT, "scripts", "buildBlockValidatorWorker.mjs"), "--outfile", outfile],
    { cwd: CMS_ROOT, stdio: "ignore" },
  )
  process.env.BLOCK_VALIDATOR_WORKER_PATH = outfile
  startBlockValidator()
  while (!isBlockValidatorReady()) {
    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })
  }
}

export { stopBlockValidator }

export interface ValidationErrorBody {
  clientId: string | null
  path: (string | number)[]
  code: string
  message: string
  fix: string
}

export interface ValidationBody {
  valid: boolean
  blocks: TestBlock[]
  errors: ValidationErrorBody[]
}

export interface TestBlock {
  clientId: string
  name: string
  isValid?: boolean
  attributes: Record<string, unknown>
  innerBlocks: TestBlock[]
}

let clientIdCounter = 0

/** A block in stored form; inner blocks get their own client ids. */
export const block = (
  name: string,
  attributes: Record<string, unknown> = {},
  innerBlocks: TestBlock[] = [],
): TestBlock => ({
  clientId: `client-${++clientIdCounter}`,
  name,
  isValid: true,
  attributes,
  innerBlocks,
})

export const validate = async (
  blocks: unknown[],
  pageType = "course-page",
  extra: Record<string, unknown> = {},
): Promise<ValidationBody> => {
  const response = await callBlockValidator({
    kind: "validate",
    body: { page_type: pageType, blocks, ...extra },
  })
  if (response.status !== 200) {
    throw new Error(`validator answered ${response.status}: ${JSON.stringify(response.body)}`)
  }
  return response.body as ValidationBody
}
