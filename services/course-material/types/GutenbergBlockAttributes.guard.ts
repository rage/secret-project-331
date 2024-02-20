/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "GutenbergBlockAttributes.ts".
 * WARNING: Do not manually change this file.
 */
import {
  AudioAttributes,
  BlockAttributes,
  ButtonAttributes,
  ButtonsAttributes,
  CellAttributes,
  Cells,
  CodeAttributes,
  ColumnAttributes,
  ColumnsAttributes,
  EmbedAttributes,
  FileAttributes,
  HeadingAttributes,
  HtmlAttributes,
  ImageAttributes,
  ListAttributes,
  ListItemAttributes,
  ParagraphAttributes,
  PreformattedAttributes,
  PullquoteAttributes,
  QuoteAttributes,
  SeparatorAttributes,
  SpacerAttributes,
  TableAttributes,
  VerseAttributes,
} from "./GutenbergBlockAttributes"

export function isAudioAttributes(obj: unknown): obj is AudioAttributes {
  const typedObj = obj as AudioAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["src"] === "undefined" || typeof typedObj["src"] === "string") &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["autoplay"] === "undefined" ||
      typedObj["autoplay"] === false ||
      typedObj["autoplay"] === true) &&
    (typeof typedObj["loop"] === "undefined" ||
      typedObj["loop"] === false ||
      typedObj["loop"] === true) &&
    (typeof typedObj["preload"] === "undefined" || typeof typedObj["preload"] === "string") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isBlockAttributes(obj: unknown): obj is BlockAttributes {
  const typedObj = obj as BlockAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["ref"] === "undefined" || typeof typedObj["ref"] === "number") &&
    (typeof typedObj["overrides"] === "undefined" ||
      (((typedObj["overrides"] !== null && typeof typedObj["overrides"] === "object") ||
        typeof typedObj["overrides"] === "function") &&
        Object.entries<any>(typedObj["overrides"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonAttributes(obj: unknown): obj is ButtonAttributes {
  const typedObj = obj as ButtonAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typedObj["tagName"] === "a" || typedObj["tagName"] === "button") &&
    typeof typedObj["type"] === "string" &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonsAttributes(obj: unknown): obj is ButtonsAttributes {
  const typedObj = obj as ButtonsAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["layout"] === "undefined" ||
      (((typedObj["layout"] !== null && typeof typedObj["layout"] === "object") ||
        typeof typedObj["layout"] === "function") &&
        Object.entries<any>(typedObj["layout"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isCodeAttributes(obj: unknown): obj is CodeAttributes {
  const typedObj = obj as CodeAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isColumnAttributes(obj: unknown): obj is ColumnAttributes {
  const typedObj = obj as ColumnAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["verticalAlignment"] === "undefined" ||
      typeof typedObj["verticalAlignment"] === "string") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "string") &&
    (typeof typedObj["allowedBlocks"] === "undefined" ||
      Array.isArray(typedObj["allowedBlocks"])) &&
    (typeof typedObj["templateLock"] === "undefined" ||
      typedObj["templateLock"] === false ||
      typedObj["templateLock"] === "all" ||
      typedObj["templateLock"] === "insert" ||
      typedObj["templateLock"] === "contentOnly") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["layout"] === "undefined" ||
      (((typedObj["layout"] !== null && typeof typedObj["layout"] === "object") ||
        typeof typedObj["layout"] === "function") &&
        Object.entries<any>(typedObj["layout"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isColumnsAttributes(obj: unknown): obj is ColumnsAttributes {
  const typedObj = obj as ColumnsAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["verticalAlignment"] === "undefined" ||
      typeof typedObj["verticalAlignment"] === "string") &&
    typeof typedObj["isStackedOnMobile"] === "boolean" &&
    (typeof typedObj["templateLock"] === "undefined" ||
      typedObj["templateLock"] === false ||
      typedObj["templateLock"] === "all" ||
      typedObj["templateLock"] === "insert" ||
      typedObj["templateLock"] === "contentOnly") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["layout"] === "undefined" ||
      (((typedObj["layout"] !== null && typeof typedObj["layout"] === "object") ||
        typeof typedObj["layout"] === "function") &&
        Object.entries<any>(typedObj["layout"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isEmbedAttributes(obj: unknown): obj is EmbedAttributes {
  const typedObj = obj as EmbedAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["type"] === "undefined" || typeof typedObj["type"] === "string") &&
    (typeof typedObj["providerNameSlug"] === "undefined" ||
      typeof typedObj["providerNameSlug"] === "string") &&
    typeof typedObj["allowResponsive"] === "boolean" &&
    typeof typedObj["responsive"] === "boolean" &&
    typeof typedObj["previewable"] === "boolean" &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string")
  )
}

export function isFileAttributes(obj: unknown): obj is FileAttributes {
  const typedObj = obj as FileAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["fileId"] === "undefined" || typeof typedObj["fileId"] === "string") &&
    (typeof typedObj["fileName"] === "undefined" || typeof typedObj["fileName"] === "string") &&
    (typeof typedObj["textLinkHref"] === "undefined" ||
      typeof typedObj["textLinkHref"] === "string") &&
    (typeof typedObj["textLinkTarget"] === "undefined" ||
      typeof typedObj["textLinkTarget"] === "string") &&
    typeof typedObj["showDownloadButton"] === "boolean" &&
    (typeof typedObj["downloadButtonText"] === "undefined" ||
      typeof typedObj["downloadButtonText"] === "string") &&
    (typeof typedObj["displayPreview"] === "undefined" ||
      typedObj["displayPreview"] === false ||
      typedObj["displayPreview"] === true) &&
    typeof typedObj["previewHeight"] === "number" &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isHeadingAttributes(obj: unknown): obj is HeadingAttributes {
  const typedObj = obj as HeadingAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    typeof typedObj["level"] === "number" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isHtmlAttributes(obj: unknown): obj is HtmlAttributes {
  const typedObj = obj as HtmlAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isImageAttributes(obj: unknown): obj is ImageAttributes {
  const typedObj = obj as ImageAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["lightbox"] === "undefined" ||
      (((typedObj["lightbox"] !== null && typeof typedObj["lightbox"] === "object") ||
        typeof typedObj["lightbox"] === "function") &&
        Object.entries<any>(typedObj["lightbox"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["linkClass"] === "undefined" || typeof typedObj["linkClass"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "string") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "string") &&
    (typeof typedObj["aspectRatio"] === "undefined" ||
      typeof typedObj["aspectRatio"] === "string") &&
    (typeof typedObj["scale"] === "undefined" || typeof typedObj["scale"] === "string") &&
    (typeof typedObj["sizeSlug"] === "undefined" || typeof typedObj["sizeSlug"] === "string") &&
    typeof typedObj["linkDestination"] === "string" &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    typeof typedObj["blurDataUrl"] === "string"
  )
}

export function isListAttributes(obj: unknown): obj is ListAttributes {
  const typedObj = obj as ListAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["ordered"] === "boolean" &&
    typeof typedObj["values"] === "string" &&
    (typeof typedObj["type"] === "undefined" || typeof typedObj["type"] === "string") &&
    (typeof typedObj["start"] === "undefined" || typeof typedObj["start"] === "number") &&
    (typeof typedObj["reversed"] === "undefined" ||
      typedObj["reversed"] === false ||
      typedObj["reversed"] === true) &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isListItemAttributes(obj: unknown): obj is ListItemAttributes {
  const typedObj = obj as ListItemAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isParagraphAttributes(obj: unknown): obj is ParagraphAttributes {
  const typedObj = obj as ParagraphAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPreformattedAttributes(obj: unknown): obj is PreformattedAttributes {
  const typedObj = obj as PreformattedAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteAttributes(obj: unknown): obj is PullquoteAttributes {
  const typedObj = obj as PullquoteAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    (typeof typedObj["citation"] === "undefined" || typeof typedObj["citation"] === "string") &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isQuoteAttributes(obj: unknown): obj is QuoteAttributes {
  const typedObj = obj as QuoteAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["value"] === "string" &&
    (typeof typedObj["citation"] === "undefined" || typeof typedObj["citation"] === "string") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["layout"] === "undefined" ||
      (((typedObj["layout"] !== null && typeof typedObj["layout"] === "object") ||
        typeof typedObj["layout"] === "function") &&
        Object.entries<any>(typedObj["layout"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isSeparatorAttributes(obj: unknown): obj is SeparatorAttributes {
  const typedObj = obj as SeparatorAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["opacity"] === "string" &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isSpacerAttributes(obj: unknown): obj is SpacerAttributes {
  const typedObj = obj as SpacerAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["height"] === "string" &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isTableAttributes(obj: unknown): obj is TableAttributes {
  const typedObj = obj as TableAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["hasFixedLayout"] === "boolean" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    Array.isArray(typedObj["head"]) &&
    typedObj["head"].every((e: any) => isCells(e) as boolean) &&
    Array.isArray(typedObj["body"]) &&
    typedObj["body"].every((e: any) => isCells(e) as boolean) &&
    Array.isArray(typedObj["foot"]) &&
    typedObj["foot"].every((e: any) => isCells(e) as boolean) &&
    (typeof typedObj["align"] === "undefined" ||
      typedObj["align"] === "" ||
      typedObj["align"] === "left" ||
      typedObj["align"] === "center" ||
      typedObj["align"] === "right" ||
      typedObj["align"] === "wide" ||
      typedObj["align"] === "full") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isCells(obj: unknown): obj is Cells {
  const typedObj = obj as Cells
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["cells"] === "undefined" ||
      (Array.isArray(typedObj["cells"]) &&
        typedObj["cells"].every((e: any) => isCellAttributes(e) as boolean)))
  )
}

export function isCellAttributes(obj: unknown): obj is CellAttributes {
  const typedObj = obj as CellAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    (typeof typedObj["tag"] === "undefined" || typeof typedObj["tag"] === "string") &&
    (typeof typedObj["scope"] === "undefined" || typeof typedObj["scope"] === "string") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["colspan"] === "undefined" || typeof typedObj["colspan"] === "string") &&
    (typeof typedObj["rowspan"] === "undefined" || typeof typedObj["rowspan"] === "string")
  )
}

export function isVerseAttributes(obj: unknown): obj is VerseAttributes {
  const typedObj = obj as VerseAttributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["content"] === "undefined" || typeof typedObj["content"] === "string") &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
    (typeof typedObj["fontFamily"] === "undefined" || typeof typedObj["fontFamily"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}
