/* eslint-disable i18next/no-literal-string */
import { assign } from "lodash"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#blocks-registerblocktype
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
  if (name === "core/embed") {
    settings.attributes = assign(settings.attributes, {
      height: {
        type: "string",
        default: "500",
      },
      title: {
        type: "string",
        default: "Mentimeter embed",
      },
    })
  }
  return settings
}
