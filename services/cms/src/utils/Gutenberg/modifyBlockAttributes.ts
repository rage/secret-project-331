/* eslint-disable i18next/no-literal-string */
import { assign } from "lodash"

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function modifyBlockAttributes(settings: any, name: string): any {
  if (name === "core/image") {
    settings.attributes.linkDestination.default = "media"
    settings.attributes = assign(settings.attributes, {
      blurDataUrl: {
        type: "string",
        default: "",
      },
    })
  }
  return settings
}
