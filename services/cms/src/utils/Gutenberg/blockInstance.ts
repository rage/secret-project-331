import { BlockInstance } from "@wordpress/blocks"

export function isBlockInstanceArray(obj: unknown): obj is BlockInstance[] {
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
