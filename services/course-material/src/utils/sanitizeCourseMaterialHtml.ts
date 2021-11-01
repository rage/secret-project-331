/* eslint-disable i18next/no-literal-string */
import sanitizeHtml from "sanitize-html"

export const sanitizeCourseMaterialHtml = (
  dirty: string,
  options?: sanitizeHtml.IOptions,
): string => {
  const newOptions: sanitizeHtml.IOptions = {
    ...options,
    allowedClasses: {
      span: [
        "has-inline-color",
        "has-black-color",
        "has-cyan-bluish-gray-color",
        "has-white-color",
        "has-pale-pink-color",
        "has-vivid-red-color",
        "has-luminous-vivid-orange-color",
        "has-luminous-vivid-amber-color",
        "has-light-green-cyan-color",
        "has-vivid-green-cyan-color",
        "has-pale-cyan-blue-color",
        "has-vivid-cyan-blue-color",
        "has-vivid-purple-color",
      ],
    },
  }
  return sanitizeHtml(dirty, newOptions)
}
