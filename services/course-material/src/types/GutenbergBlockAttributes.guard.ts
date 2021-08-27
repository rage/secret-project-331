/*
 * Generated type guards for "GutenbergBlockAttributes.ts".
 * WARNING: Do not manually change this file.
 */
import {
  AudioAttributes,
  BlockAttributes,
  ButtonAttributes,
  ButtonsAttributes,
  CodeAttributes,
  ColumnAttributes,
  ColumnsAttributes,
  EmbedAttributes,
  FileAttributes,
  GroupAttributes,
  HeadingAttributes,
  HtmlAttributes,
  ImageAttributes,
  ListAttributes,
  ParagraphAttributes,
  PreformattedAttributes,
  PullquoteAttributes,
  QuoteAttributes,
  RssAttributes,
  SeparatorAttributes,
  ShortcodeAttributes,
  SpacerAttributes,
  TableAttributes,
  TextColumnsAttributes,
  VerseAttributes,
} from "./GutenbergBlockAttributes"

export function isParagraphAttributes(
  obj: any,
  _argumentName?: string,
): obj is ParagraphAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.dropCap === "boolean" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.direction === "undefined" || obj.direction === "ltr" || obj.direction === "rtl") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isImageAttributes(obj: any, _argumentName?: string): obj is ImageAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    typeof obj.alt === "string" &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.linkClass === "undefined" || typeof obj.linkClass === "string") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    (typeof obj.sizeSlug === "undefined" || typeof obj.sizeSlug === "string") &&
    typeof obj.linkDestination === "string" &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    typeof obj.blurDataUrl === "string"
  )
}

export function isHeadingAttributes(obj: any, _argumentName?: string): obj is HeadingAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.textAlign === "undefined" || typeof obj.textAlign === "string") &&
    typeof obj.content === "string" &&
    typeof obj.level === "number" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isListAttributes(obj: any, _argumentName?: string): obj is ListAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.ordered === "boolean" &&
    typeof obj.values === "string" &&
    (typeof obj.type === "undefined" || typeof obj.type === "string") &&
    (typeof obj.start === "undefined" || typeof obj.start === "number") &&
    (typeof obj.reversed === "undefined" || obj.reversed === false || obj.reversed === true) &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isQuoteAttributes(obj: any, _argumentName?: string): obj is QuoteAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.value === "string" &&
    typeof obj.citation === "string" &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isShortcodeAttributes(
  obj: any,
  _argumentName?: string,
): obj is ShortcodeAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string")
  )
}

export function isAudioAttributes(obj: any, _argumentName?: string): obj is AudioAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.src === "undefined" || typeof obj.src === "string") &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.autoplay === "undefined" || obj.autoplay === false || obj.autoplay === true) &&
    (typeof obj.loop === "undefined" || obj.loop === false || obj.loop === true) &&
    (typeof obj.preload === "undefined" || typeof obj.preload === "string") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonAttributes(obj: any, _argumentName?: string): obj is ButtonAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isButtonsAttributes(obj: any, _argumentName?: string): obj is ButtonsAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.contentJustification === "undefined" ||
      typeof obj.contentJustification === "string") &&
    typeof obj.orientation === "string" &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isCodeAttributes(obj: any, _argumentName?: string): obj is CodeAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.content === "undefined" || typeof obj.content === "string") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isColumnsAttributes(obj: any, _argumentName?: string): obj is ColumnsAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.verticalAlignment === "undefined" || typeof obj.verticalAlignment === "string") &&
    typeof obj.isStackedOnMobile === "boolean" &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isColumnAttributes(obj: any, _argumentName?: string): obj is ColumnAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.verticalAlignment === "undefined" || typeof obj.verticalAlignment === "string") &&
    (typeof obj.width === "undefined" || typeof obj.width === "string") &&
    (typeof obj.templateLock === "undefined" ||
      obj.templateLock === false ||
      obj.templateLock === "all" ||
      obj.templateLock === "insert") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isEmbedAttributes(obj: any, _argumentName?: string): obj is EmbedAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.type === "undefined" || typeof obj.type === "string") &&
    (typeof obj.providerNameSlug === "undefined" || typeof obj.providerNameSlug === "string") &&
    typeof obj.allowResponsive === "boolean" &&
    typeof obj.responsive === "boolean" &&
    typeof obj.previewable === "boolean" &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isFileAttributes(obj: any, _argumentName?: string): obj is FileAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.fileName === "undefined" || typeof obj.fileName === "string") &&
    (typeof obj.textLinkHref === "undefined" || typeof obj.textLinkHref === "string") &&
    (typeof obj.textLinkTarget === "undefined" || typeof obj.textLinkTarget === "string") &&
    typeof obj.showDownloadButton === "boolean" &&
    (typeof obj.downloadButtonText === "undefined" || typeof obj.downloadButtonText === "string") &&
    (typeof obj.displayPreview === "undefined" ||
      obj.displayPreview === false ||
      obj.displayPreview === true) &&
    typeof obj.previewHeight === "number" &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isGroupAttributes(obj: any, _argumentName?: string): obj is GroupAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.tagName === "string" &&
    (typeof obj.templateLock === "undefined" ||
      obj.templateLock === false ||
      obj.templateLock === "all" ||
      obj.templateLock === "insert") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.borderColor === "undefined" || typeof obj.borderColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    (typeof obj.layout === "undefined" ||
      (obj.layout !== null && typeof obj.layout === "object") ||
      typeof obj.layout === "function")
  )
}

export function isHtmlAttributes(obj: any, _argumentName?: string): obj is HtmlAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.content === "undefined" || typeof obj.content === "string")
  )
}

export function isPreformattedAttributes(
  obj: any,
  _argumentName?: string,
): obj is PreformattedAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.content === "string" &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isPullquoteAttributes(
  obj: any,
  _argumentName?: string,
): obj is PullquoteAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.value === "undefined" || typeof obj.value === "string") &&
    typeof obj.citation === "string" &&
    (typeof obj.textAlign === "undefined" || typeof obj.textAlign === "string") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.borderColor === "undefined" || typeof obj.borderColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isRssAttributes(obj: any, _argumentName?: string): obj is RssAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.columns === "number" &&
    typeof obj.blockLayout === "string" &&
    typeof obj.feedURL === "string" &&
    typeof obj.itemsToShow === "number" &&
    typeof obj.displayExcerpt === "boolean" &&
    typeof obj.displayAuthor === "boolean" &&
    typeof obj.displayDate === "boolean" &&
    typeof obj.excerptLength === "number" &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isSeparatorAttributes(
  obj: any,
  _argumentName?: string,
): obj is SeparatorAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.color === "undefined" || typeof obj.color === "string") &&
    (typeof obj.customColor === "undefined" || typeof obj.customColor === "string") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isBlockAttributes(obj: any, _argumentName?: string): obj is BlockAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.ref === "undefined" || typeof obj.ref === "number")
  )
}

export function isSpacerAttributes(obj: any, _argumentName?: string): obj is SpacerAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.height === "number" &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isTableAttributes(obj: any, _argumentName?: string): obj is TableAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.hasFixedLayout === "boolean" &&
    typeof obj.caption === "string" &&
    Array.isArray(obj.head) &&
    Array.isArray(obj.body) &&
    Array.isArray(obj.foot) &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.borderColor === "undefined" || typeof obj.borderColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isTextColumnsAttributes(
  obj: any,
  _argumentName?: string,
): obj is TextColumnsAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    Array.isArray(obj.content) &&
    typeof obj.columns === "number" &&
    (typeof obj.width === "undefined" || typeof obj.width === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isVerseAttributes(obj: any, _argumentName?: string): obj is VerseAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.content === "string" &&
    (typeof obj.textAlign === "undefined" || typeof obj.textAlign === "string") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}
