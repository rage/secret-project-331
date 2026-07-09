import { assign } from "lodash"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#blocks-registerblocktype

/**
 * Ensure that type core/image has some attributes set to a value, so that the CMS/image block doesn't crash when uploading image.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function modifyImageBlockAttributes(settings: any, name: string): any {
  if (name === "core/image") {
    if (settings.attributes.linkDestination) {
      settings.attributes.linkDestination.default = "media"
    }
    settings.attributes = assign(settings.attributes, {
      blurDataUrl: {
        type: "string",
        default: "",
      },
    })
  }
  return settings
}

/**
 * These are needed for Mentimeter embed InspectorControl.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function modifyEmbedBlockAttributes(settings: any, name: string): any {
  if (name === "core/embed") {
    settings.attributes = assign(settings.attributes, {
      height: {
        type: "number",
      },
      title: {
        type: "string",
      },
    })
  }
  return settings
}

/**
 * Adds a `language` attribute to core/code so the author can pick the syntax-highlighting language
 * instead of relying on highlight.js auto-detection. An empty/missing value means auto-detect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function modifyCodeBlockAttributes(settings: any, name: string): any {
  if (name === "core/code") {
    settings.attributes = assign(settings.attributes, {
      language: {
        type: "string",
      },
    })
  }
  return settings
}
