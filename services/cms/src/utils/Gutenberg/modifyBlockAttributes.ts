import { assign } from "lodash"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#blocks-registerblocktype

/**
 * Ensure that type core/image has some attributes set to a value, so that the CMS/image block doesn't crash when uploading image.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export function modifyImageBlockAttributes(settings: any, name: string): any {
  if (name === "core/image") {
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
// oxlint-disable-next-line typescript/no-explicit-any
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
 * Adds author settings to core/code: `language` picks the syntax-highlighting language (missing means
 * auto-detect), `codeWidth` is "column" (default) or "wide", and `codeFontSize` is "small", "normal"
 * (default) or "large".
 */
// oxlint-disable-next-line typescript/no-explicit-any
export function modifyCodeBlockAttributes(settings: any, name: string): any {
  if (name === "core/code") {
    settings.attributes = assign(settings.attributes, {
      language: {
        type: "string",
      },
      codeWidth: {
        type: "string",
      },
      codeFontSize: {
        type: "string",
      },
    })
  }
  return settings
}
