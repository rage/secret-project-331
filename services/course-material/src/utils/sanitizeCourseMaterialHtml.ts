/* eslint-disable i18next/no-literal-string */
import DOMPurify from "dompurify"

export const sanitizeCourseMaterialHtml = (dirty: string, config?: DOMPurify.Config): string => {
  const newConfig: DOMPurify.Config = {
    ...config,
    RETURN_TRUSTED_TYPE: true,
  }
  return DOMPurify.sanitize(dirty, newConfig).toString()
}
