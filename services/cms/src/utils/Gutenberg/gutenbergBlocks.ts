import { GutenbergBlock } from "@/shared-module/common/bindings"

export function isGutenbergBlockArray(obj: unknown): obj is GutenbergBlock[] {
  if (!Array.isArray(obj)) {
    return false
  }
  for (const o of obj) {
    if (typeof o.name !== "string" || typeof o.clientId !== "string") {
      return false
    }
  }
  return true
}
