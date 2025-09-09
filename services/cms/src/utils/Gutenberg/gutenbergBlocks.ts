import { GutenbergBlock } from "@/shared-module/common/bindings"
import { isGutenbergBlock } from "@/shared-module/common/bindings.guard"

export function isGutenbergBlockArray(obj: unknown): obj is GutenbergBlock[] {
  if (!Array.isArray(obj)) {
    return false
  }
  for (const o of obj) {
    if (!isGutenbergBlock(o)) {
      return false
    }
  }
  return true
}
