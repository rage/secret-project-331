import DOMPurify from "dompurify"

import { StringWithHTML } from "../../types"

export const sanitizeCourseMaterialHtml = (
  dirty: string | undefined | StringWithHTML,
  config?: DOMPurify.Config,
): string => {
  if (dirty === undefined) {
    return ""
  }
  const newConfig: DOMPurify.Config = {
    ...config,
    RETURN_TRUSTED_TYPE: true,
  }
  return DOMPurify.sanitize(dirty, newConfig).toString()
}
