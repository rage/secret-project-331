/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "GutenbergBlockAttributes.ts".
 * WARNING: Do not manually change this file.
 */
import {
  AudioAttributes,
  AudioDeprecated1Attributes,
  BlockAttributes,
  ButtonAttributes,
  ButtonDeprecated10Attributes,
  ButtonDeprecated11Attributes,
  ButtonDeprecated1Attributes,
  ButtonDeprecated2Attributes,
  ButtonDeprecated3Attributes,
  ButtonDeprecated4Attributes,
  ButtonDeprecated5Attributes,
  ButtonDeprecated6Attributes,
  ButtonDeprecated7Attributes,
  ButtonDeprecated8Attributes,
  ButtonDeprecated9Attributes,
  ButtonsAttributes,
  ButtonsDeprecated1Attributes,
  ButtonsDeprecated2Attributes,
  CellAttributes,
  Cells,
  CodeAttributes,
  ColumnAttributes,
  ColumnDeprecated1Attributes,
  ColumnsAttributes,
  ColumnsDeprecated1Attributes,
  ColumnsDeprecated2Attributes,
  ColumnsDeprecated3Attributes,
  EmbedAttributes,
  EmbedDeprecated1Attributes,
  FileAttributes,
  FileDeprecated1Attributes,
  HeadingAttributes,
  HeadingDeprecated1Attributes,
  HeadingDeprecated2Attributes,
  HeadingDeprecated3Attributes,
  HeadingDeprecated4Attributes,
  HtmlAttributes,
  ImageAttributes,
  ImageDeprecated1Attributes,
  ImageDeprecated2Attributes,
  ImageDeprecated3Attributes,
  ImageDeprecated4Attributes,
  ListAttributes,
  ListDeprecated1Attributes,
  ParagraphAttributes,
  ParagraphDeprecated1Attributes,
  ParagraphDeprecated2Attributes,
  ParagraphDeprecated3Attributes,
  ParagraphDeprecated4Attributes,
  ParagraphDeprecated5Attributes,
  PreformattedAttributes,
  PullquoteAttributes,
  PullquoteDeprecated1Attributes,
  PullquoteDeprecated2Attributes,
  PullquoteDeprecated3Attributes,
  PullquoteDeprecated4Attributes,
  PullquoteDeprecated5Attributes,
  QuoteAttributes,
  QuoteDeprecated1Attributes,
  QuoteDeprecated2Attributes,
  QuoteDeprecated3Attributes,
  SeparatorAttributes,
  SeparatorDeprecated1Attributes,
  SpacerAttributes,
  SpacerDeprecated1Attributes,
  TableAttributes,
  VerseAttributes,
  VerseDeprecated1Attributes,
  VerseDeprecated2Attributes,
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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

export function isParagraphDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ParagraphDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.dropCap === "boolean" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.direction === "undefined" || obj.direction === "ltr" || obj.direction === "rtl") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customFontSize === "undefined" || typeof obj.customFontSize === "number") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isParagraphDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is ParagraphDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.dropCap === "boolean" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.direction === "undefined" || obj.direction === "ltr" || obj.direction === "rtl") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customFontSize === "undefined" || typeof obj.customFontSize === "number") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isParagraphDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is ParagraphDeprecated3Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.dropCap === "boolean" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.direction === "undefined" || obj.direction === "ltr" || obj.direction === "rtl") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customFontSize === "undefined" || typeof obj.customFontSize === "number") &&
    (typeof obj.width === "undefined" || typeof obj.width === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isParagraphDeprecated4Attributes(
  obj: any,
  _argumentName?: string,
): obj is ParagraphDeprecated4Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.dropCap === "boolean" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "number") &&
    (typeof obj.direction === "undefined" || obj.direction === "ltr" || obj.direction === "rtl") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isParagraphDeprecated5Attributes(
  obj: any,
  _argumentName?: string,
): obj is ParagraphDeprecated5Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.dropCap === "boolean" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.direction === "undefined" || obj.direction === "ltr" || obj.direction === "rtl") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    typeof obj.blurDataUrl === "string"
  )
}

export function isImageDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ImageDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    typeof obj.alt === "string" &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.linkClass === "undefined" || typeof obj.linkClass === "string") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    typeof obj.linkDestination === "string" &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.sizeSlug === "undefined" || typeof obj.sizeSlug === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    typeof obj.blurDataUrl === "string"
  )
}

export function isImageDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is ImageDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    typeof obj.alt === "string" &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.linkClass === "undefined" || typeof obj.linkClass === "string") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    typeof obj.linkDestination === "string" &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    typeof obj.blurDataUrl === "string"
  )
}

export function isImageDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is ImageDeprecated3Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    typeof obj.alt === "string" &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.linkClass === "undefined" || typeof obj.linkClass === "string") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    typeof obj.linkDestination === "string" &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    typeof obj.blurDataUrl === "string"
  )
}

export function isImageDeprecated4Attributes(
  obj: any,
  _argumentName?: string,
): obj is ImageDeprecated4Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    typeof obj.alt === "string" &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.linkClass === "undefined" || typeof obj.linkClass === "string") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    typeof obj.linkDestination === "string" &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isHeadingDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is HeadingDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.level === "number" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isHeadingDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is HeadingDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.level === "number" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isHeadingDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is HeadingDeprecated3Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.level === "number" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isHeadingDeprecated4Attributes(
  obj: any,
  _argumentName?: string,
): obj is HeadingDeprecated4Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.content === "string" &&
    typeof obj.level === "number" &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isListDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ListDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.ordered === "boolean" &&
    typeof obj.values === "string" &&
    (typeof obj.type === "undefined" || typeof obj.type === "string") &&
    (typeof obj.start === "undefined" || typeof obj.start === "number") &&
    (typeof obj.reversed === "undefined" || obj.reversed === false || obj.reversed === true) &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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

export function isQuoteDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is QuoteDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.value === "string" &&
    typeof obj.citation === "string" &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isQuoteDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is QuoteDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.value === "string" &&
    typeof obj.citation === "string" &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.style === "number" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isQuoteDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is QuoteDeprecated3Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.value === "string" &&
    typeof obj.citation === "string" &&
    (typeof obj.align === "undefined" || typeof obj.align === "string") &&
    typeof obj.style === "number" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isAudioDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is AudioDeprecated1Attributes {
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isButtonDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated1Attributes {
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isButtonDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated2Attributes {
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isButtonDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated3Attributes {
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isButtonDeprecated4Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated4Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.borderRadius === "undefined" || typeof obj.borderRadius === "number") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated5Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated5Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.borderRadius === "undefined" || typeof obj.borderRadius === "number") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated6Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated6Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.borderRadius === "undefined" || typeof obj.borderRadius === "number") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated7Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated7Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.borderRadius === "undefined" || typeof obj.borderRadius === "number") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.customGradient === "undefined" || typeof obj.customGradient === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated8Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated8Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    typeof obj.align === "string" &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.linkTarget === "undefined" || typeof obj.linkTarget === "string") &&
    (typeof obj.rel === "undefined" || typeof obj.rel === "string") &&
    (typeof obj.placeholder === "undefined" || typeof obj.placeholder === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated9Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated9Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    typeof obj.align === "string" &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated10Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated10Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.color === "undefined" || typeof obj.color === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    typeof obj.align === "string" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonDeprecated11Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonDeprecated11Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string") &&
    (typeof obj.text === "undefined" || typeof obj.text === "string") &&
    (typeof obj.color === "undefined" || typeof obj.color === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    typeof obj.align === "string" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isButtonsAttributes(obj: any, _argumentName?: string): obj is ButtonsAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function") &&
    (typeof obj.layout === "undefined" ||
      (obj.layout !== null && typeof obj.layout === "object") ||
      typeof obj.layout === "function")
  )
}

export function isButtonsDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonsDeprecated1Attributes {
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isButtonsDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is ButtonsDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isCodeAttributes(obj: any, _argumentName?: string): obj is CodeAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.content === "undefined" || typeof obj.content === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.borderColor === "undefined" || typeof obj.borderColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
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
    (typeof obj.allowedBlocks === "undefined" || Array.isArray(obj.allowedBlocks)) &&
    (typeof obj.templateLock === "undefined" ||
      obj.templateLock === false ||
      obj.templateLock === "all" ||
      obj.templateLock === "insert") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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

export function isColumnDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ColumnDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.verticalAlignment === "undefined" || typeof obj.verticalAlignment === "string") &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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

export function isColumnsDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is ColumnsDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.verticalAlignment === "undefined" || typeof obj.verticalAlignment === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.customBackgroundColor === "undefined" ||
      typeof obj.customBackgroundColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isColumnsDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is ColumnsDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.columns === "number" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isColumnsDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is ColumnsDeprecated3Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.columns === "number" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string")
  )
}

export function isEmbedDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is EmbedDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.url === "undefined" || typeof obj.url === "string") &&
    (typeof obj.caption === "undefined" || typeof obj.caption === "string") &&
    (typeof obj.type === "undefined" || typeof obj.type === "string") &&
    (typeof obj.providerNameSlug === "undefined" || typeof obj.providerNameSlug === "string") &&
    typeof obj.allowResponsive === "boolean" &&
    typeof obj.responsive === "boolean" &&
    typeof obj.previewable === "boolean" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.height === "undefined" || typeof obj.height === "number") &&
    (typeof obj.title === "undefined" || typeof obj.title === "string")
  )
}

export function isFileAttributes(obj: any, _argumentName?: string): obj is FileAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.id === "undefined" || typeof obj.id === "number") &&
    (typeof obj.href === "undefined" || typeof obj.href === "string") &&
    (typeof obj.fileId === "undefined" || typeof obj.fileId === "string") &&
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isFileDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is FileDeprecated1Attributes {
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isHtmlAttributes(obj: any, _argumentName?: string): obj is HtmlAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.content === "undefined" || typeof obj.content === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function")
  )
}

export function isPreformattedAttributes(
  obj: any,
  _argumentName?: string,
): obj is PreformattedAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.content === "string" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.borderColor === "undefined" || typeof obj.borderColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isPullquoteDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is PullquoteDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.value === "undefined" || typeof obj.value === "string") &&
    typeof obj.citation === "string" &&
    (typeof obj.mainColor === "undefined" || typeof obj.mainColor === "string") &&
    (typeof obj.customMainColor === "undefined" || typeof obj.customMainColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isPullquoteDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is PullquoteDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.value === "undefined" || typeof obj.value === "string") &&
    typeof obj.citation === "string" &&
    (typeof obj.mainColor === "undefined" || typeof obj.mainColor === "string") &&
    (typeof obj.customMainColor === "undefined" || typeof obj.customMainColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.figureStyle === "undefined" ||
      (obj.figureStyle !== null && typeof obj.figureStyle === "object") ||
      typeof obj.figureStyle === "function") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isPullquoteDeprecated3Attributes(
  obj: any,
  _argumentName?: string,
): obj is PullquoteDeprecated3Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.value === "undefined" || typeof obj.value === "string") &&
    typeof obj.citation === "string" &&
    (typeof obj.mainColor === "undefined" || typeof obj.mainColor === "string") &&
    (typeof obj.customMainColor === "undefined" || typeof obj.customMainColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isPullquoteDeprecated4Attributes(
  obj: any,
  _argumentName?: string,
): obj is PullquoteDeprecated4Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.value === "undefined" || typeof obj.value === "string") &&
    typeof obj.citation === "string" &&
    (typeof obj.mainColor === "undefined" || typeof obj.mainColor === "string") &&
    (typeof obj.customMainColor === "undefined" || typeof obj.customMainColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isPullquoteDeprecated5Attributes(
  obj: any,
  _argumentName?: string,
): obj is PullquoteDeprecated5Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.value === "undefined" || typeof obj.value === "string") &&
    (typeof obj.citation === "undefined" || typeof obj.citation === "string") &&
    (typeof obj.mainColor === "undefined" || typeof obj.mainColor === "string") &&
    (typeof obj.customMainColor === "undefined" || typeof obj.customMainColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.customTextColor === "undefined" || typeof obj.customTextColor === "string") &&
    typeof obj.align === "string" &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isBlockAttributes(obj: any, _argumentName?: string): obj is BlockAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.ref === "undefined" || typeof obj.ref === "number") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function")
  )
}

export function isSeparatorAttributes(
  obj: any,
  _argumentName?: string,
): obj is SeparatorAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.opacity === "string" &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
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

export function isSeparatorDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is SeparatorDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.color === "undefined" || typeof obj.color === "string") &&
    (typeof obj.customColor === "undefined" || typeof obj.customColor === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isSpacerAttributes(obj: any, _argumentName?: string): obj is SpacerAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.height === "string" &&
    (typeof obj.width === "undefined" || typeof obj.width === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isSpacerDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is SpacerDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.height === "number" &&
    (typeof obj.width === "undefined" || typeof obj.width === "number") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}

export function isTableAttributes(obj: any, _argumentName?: string): obj is TableAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.hasFixedLayout === "boolean" &&
    typeof obj.caption === "string" &&
    Array.isArray(obj.head) &&
    obj.head.every((e: any) => isCells(e) as boolean) &&
    Array.isArray(obj.body) &&
    obj.body.every((e: any) => isCells(e) as boolean) &&
    Array.isArray(obj.foot) &&
    obj.foot.every((e: any) => isCells(e) as boolean) &&
    (typeof obj.align === "undefined" ||
      obj.align === "" ||
      obj.align === "left" ||
      obj.align === "center" ||
      obj.align === "right" ||
      obj.align === "wide" ||
      obj.align === "full") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.borderColor === "undefined" || typeof obj.borderColor === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isCells(obj: any, _argumentName?: string): obj is Cells {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.cells === "undefined" ||
      (Array.isArray(obj.cells) && obj.cells.every((e: any) => isCellAttributes(e) as boolean)))
  )
}

export function isCellAttributes(obj: any, _argumentName?: string): obj is CellAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    (typeof obj.content === "undefined" || typeof obj.content === "string") &&
    (typeof obj.tag === "undefined" || typeof obj.tag === "string") &&
    (typeof obj.scope === "undefined" || typeof obj.scope === "string") &&
    (typeof obj.align === "undefined" || typeof obj.align === "string")
  )
}

export function isVerseAttributes(obj: any, _argumentName?: string): obj is VerseAttributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.content === "string" &&
    (typeof obj.textAlign === "undefined" || typeof obj.textAlign === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isVerseDeprecated1Attributes(
  obj: any,
  _argumentName?: string,
): obj is VerseDeprecated1Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.content === "string" &&
    (typeof obj.textAlign === "undefined" || typeof obj.textAlign === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.anchor === "undefined" || typeof obj.anchor === "string") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string") &&
    (typeof obj.backgroundColor === "undefined" || typeof obj.backgroundColor === "string") &&
    (typeof obj.textColor === "undefined" || typeof obj.textColor === "string") &&
    (typeof obj.gradient === "undefined" || typeof obj.gradient === "string") &&
    (typeof obj.fontFamily === "undefined" || typeof obj.fontFamily === "string") &&
    (typeof obj.fontSize === "undefined" || typeof obj.fontSize === "string") &&
    (typeof obj.style === "undefined" ||
      (obj.style !== null && typeof obj.style === "object") ||
      typeof obj.style === "function")
  )
}

export function isVerseDeprecated2Attributes(
  obj: any,
  _argumentName?: string,
): obj is VerseDeprecated2Attributes {
  return (
    ((obj !== null && typeof obj === "object") || typeof obj === "function") &&
    typeof obj.content === "string" &&
    (typeof obj.textAlign === "undefined" || typeof obj.textAlign === "string") &&
    (typeof obj.lock === "undefined" ||
      (obj.lock !== null && typeof obj.lock === "object") ||
      typeof obj.lock === "function") &&
    (typeof obj.className === "undefined" || typeof obj.className === "string")
  )
}
