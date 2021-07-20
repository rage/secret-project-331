import { assign } from "lodash"

export function modifyBlockAttributes(settings: any, name: any) {
  if (name !== "core/image") {
    return settings
  }

  settings.attributes.linkDestination.default = "media"
  settings.attributes = assign(settings.attributes, {
    blurDataUrl: {
      type: "string",
      default: "",
    },
  })

  return settings
}
