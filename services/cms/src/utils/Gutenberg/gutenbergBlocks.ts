import { GutenbergBlock } from "@/generated/api"
import { zGutenbergBlock } from "@/generated/api/zod.generated"

export function isGutenbergBlockArray(obj: unknown): obj is GutenbergBlock[] {
  if (!Array.isArray(obj)) {
    return false
  }
  for (const o of obj) {
    if (!zGutenbergBlock.safeParse(o).success) {
      return false
    }
  }
  return true
}
