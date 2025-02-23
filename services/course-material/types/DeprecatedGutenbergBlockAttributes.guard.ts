/*
 * Generated type guards for "DeprecatedGutenbergBlockAttributes.ts".
 * WARNING: Do not manually change this file.
 */
import {
  AudioDeprecated1Attributes,
  BlockDeprecated1Attributes,
  BlockDeprecated2Attributes,
  ButtonDeprecated10Attributes,
  ButtonDeprecated11Attributes,
  ButtonDeprecated12Attributes,
  ButtonDeprecated1Attributes,
  ButtonDeprecated2Attributes,
  ButtonDeprecated3Attributes,
  ButtonDeprecated4Attributes,
  ButtonDeprecated5Attributes,
  ButtonDeprecated6Attributes,
  ButtonDeprecated7Attributes,
  ButtonDeprecated8Attributes,
  ButtonDeprecated9Attributes,
  ButtonsDeprecated1Attributes,
  ButtonsDeprecated2Attributes,
  ColumnDeprecated1Attributes,
  ColumnsDeprecated1Attributes,
  ColumnsDeprecated2Attributes,
  ColumnsDeprecated3Attributes,
  EmbedDeprecated1Attributes,
  EmbedDeprecated2Attributes,
  FileDeprecated1Attributes,
  FileDeprecated2Attributes,
  FileDeprecated3Attributes,
  HeadingDeprecated1Attributes,
  HeadingDeprecated2Attributes,
  HeadingDeprecated3Attributes,
  HeadingDeprecated4Attributes,
  HeadingDeprecated5Attributes,
  ImageDeprecated1Attributes,
  ImageDeprecated2Attributes,
  ImageDeprecated3Attributes,
  ImageDeprecated4Attributes,
  ImageDeprecated5Attributes,
  ImageDeprecated6Attributes,
  ImageDeprecated7Attributes,
  ImageDeprecated8Attributes,
  ListDeprecated1Attributes,
  ListDeprecated2Attributes,
  ListDeprecated3Attributes,
  ListDeprecated4Attributes,
  ParagraphDeprecated1Attributes,
  ParagraphDeprecated2Attributes,
  ParagraphDeprecated3Attributes,
  ParagraphDeprecated4Attributes,
  ParagraphDeprecated5Attributes,
  ParagraphDeprecated6Attributes,
  PullquoteDeprecated1Attributes,
  PullquoteDeprecated2Attributes,
  PullquoteDeprecated3Attributes,
  PullquoteDeprecated4Attributes,
  PullquoteDeprecated5Attributes,
  PullquoteDeprecated6Attributes,
  QuoteDeprecated1Attributes,
  QuoteDeprecated2Attributes,
  QuoteDeprecated3Attributes,
  QuoteDeprecated4Attributes,
  QuoteDeprecated5Attributes,
  SeparatorDeprecated1Attributes,
  SpacerDeprecated1Attributes,
  VerseDeprecated1Attributes,
  VerseDeprecated2Attributes,
} from "./DeprecatedGutenbergBlockAttributes"

export function isAudioDeprecated1Attributes(obj: unknown): obj is AudioDeprecated1Attributes {
  const typedObj = obj as AudioDeprecated1Attributes
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
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isBlockDeprecated1Attributes(obj: unknown): obj is BlockDeprecated1Attributes {
  const typedObj = obj as BlockDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["ref"] === "undefined" || typeof typedObj["ref"] === "number") &&
    (typeof typedObj["content"] === "undefined" ||
      (((typedObj["content"] !== null && typeof typedObj["content"] === "object") ||
        typeof typedObj["content"] === "function") &&
        Object.entries<any>(typedObj["content"]).every(
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

export function isBlockDeprecated2Attributes(obj: unknown): obj is BlockDeprecated2Attributes {
  const typedObj = obj as BlockDeprecated2Attributes
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

export function isButtonDeprecated10Attributes(obj: unknown): obj is ButtonDeprecated10Attributes {
  const typedObj = obj as ButtonDeprecated10Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    typeof typedObj["align"] === "string" &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated11Attributes(obj: unknown): obj is ButtonDeprecated11Attributes {
  const typedObj = obj as ButtonDeprecated11Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["color"] === "undefined" || typeof typedObj["color"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    typeof typedObj["align"] === "string" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated12Attributes(obj: unknown): obj is ButtonDeprecated12Attributes {
  const typedObj = obj as ButtonDeprecated12Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["color"] === "undefined" || typeof typedObj["color"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    typeof typedObj["align"] === "string" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated1Attributes(obj: unknown): obj is ButtonDeprecated1Attributes {
  const typedObj = obj as ButtonDeprecated1Attributes
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
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated2Attributes(obj: unknown): obj is ButtonDeprecated2Attributes {
  const typedObj = obj as ButtonDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated3Attributes(obj: unknown): obj is ButtonDeprecated3Attributes {
  const typedObj = obj as ButtonDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated4Attributes(obj: unknown): obj is ButtonDeprecated4Attributes {
  const typedObj = obj as ButtonDeprecated4Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated5Attributes(obj: unknown): obj is ButtonDeprecated5Attributes {
  const typedObj = obj as ButtonDeprecated5Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["borderRadius"] === "undefined" ||
      typeof typedObj["borderRadius"] === "number") &&
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
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated6Attributes(obj: unknown): obj is ButtonDeprecated6Attributes {
  const typedObj = obj as ButtonDeprecated6Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["borderRadius"] === "undefined" ||
      typeof typedObj["borderRadius"] === "number") &&
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
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated7Attributes(obj: unknown): obj is ButtonDeprecated7Attributes {
  const typedObj = obj as ButtonDeprecated7Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["borderRadius"] === "undefined" ||
      typeof typedObj["borderRadius"] === "number") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated8Attributes(obj: unknown): obj is ButtonDeprecated8Attributes {
  const typedObj = obj as ButtonDeprecated8Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["borderRadius"] === "undefined" ||
      typeof typedObj["borderRadius"] === "number") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["customGradient"] === "undefined" ||
      typeof typedObj["customGradient"] === "string") &&
    (typeof typedObj["gradient"] === "undefined" || typeof typedObj["gradient"] === "string") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonDeprecated9Attributes(obj: unknown): obj is ButtonDeprecated9Attributes {
  const typedObj = obj as ButtonDeprecated9Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["text"] === "undefined" || typeof typedObj["text"] === "string") &&
    typeof typedObj["align"] === "string" &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isButtonsDeprecated1Attributes(obj: unknown): obj is ButtonsDeprecated1Attributes {
  const typedObj = obj as ButtonsDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["contentJustification"] === "undefined" ||
      typeof typedObj["contentJustification"] === "string") &&
    typeof typedObj["orientation"] === "string" &&
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

export function isButtonsDeprecated2Attributes(obj: unknown): obj is ButtonsDeprecated2Attributes {
  const typedObj = obj as ButtonsDeprecated2Attributes
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isColumnDeprecated1Attributes(obj: unknown): obj is ColumnDeprecated1Attributes {
  const typedObj = obj as ColumnDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["verticalAlignment"] === "undefined" ||
      typeof typedObj["verticalAlignment"] === "string") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isColumnsDeprecated1Attributes(obj: unknown): obj is ColumnsDeprecated1Attributes {
  const typedObj = obj as ColumnsDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["verticalAlignment"] === "undefined" ||
      typeof typedObj["verticalAlignment"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isColumnsDeprecated2Attributes(obj: unknown): obj is ColumnsDeprecated2Attributes {
  const typedObj = obj as ColumnsDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["columns"] === "number" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isColumnsDeprecated3Attributes(obj: unknown): obj is ColumnsDeprecated3Attributes {
  const typedObj = obj as ColumnsDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["columns"] === "number" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isEmbedDeprecated1Attributes(obj: unknown): obj is EmbedDeprecated1Attributes {
  const typedObj = obj as EmbedDeprecated1Attributes
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
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isEmbedDeprecated2Attributes(obj: unknown): obj is EmbedDeprecated2Attributes {
  const typedObj = obj as EmbedDeprecated2Attributes
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
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isFileDeprecated1Attributes(obj: unknown): obj is FileDeprecated1Attributes {
  const typedObj = obj as FileDeprecated1Attributes
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isFileDeprecated2Attributes(obj: unknown): obj is FileDeprecated2Attributes {
  const typedObj = obj as FileDeprecated2Attributes
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isFileDeprecated3Attributes(obj: unknown): obj is FileDeprecated3Attributes {
  const typedObj = obj as FileDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isHeadingDeprecated1Attributes(obj: unknown): obj is HeadingDeprecated1Attributes {
  const typedObj = obj as HeadingDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    typeof typedObj["content"] === "string" &&
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

export function isHeadingDeprecated2Attributes(obj: unknown): obj is HeadingDeprecated2Attributes {
  const typedObj = obj as HeadingDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["level"] === "number" &&
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

export function isHeadingDeprecated3Attributes(obj: unknown): obj is HeadingDeprecated3Attributes {
  const typedObj = obj as HeadingDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["level"] === "number" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isHeadingDeprecated4Attributes(obj: unknown): obj is HeadingDeprecated4Attributes {
  const typedObj = obj as HeadingDeprecated4Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["level"] === "number" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isHeadingDeprecated5Attributes(obj: unknown): obj is HeadingDeprecated5Attributes {
  const typedObj = obj as HeadingDeprecated5Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["level"] === "number" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isImageDeprecated1Attributes(obj: unknown): obj is ImageDeprecated1Attributes {
  const typedObj = obj as ImageDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["behaviors"] === "undefined" ||
      (((typedObj["behaviors"] !== null && typeof typedObj["behaviors"] === "object") ||
        typeof typedObj["behaviors"] === "function") &&
        Object.entries<any>(typedObj["behaviors"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
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
    (typeof typedObj["linkDestination"] === "undefined" ||
      typeof typedObj["linkDestination"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
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

export function isImageDeprecated2Attributes(obj: unknown): obj is ImageDeprecated2Attributes {
  const typedObj = obj as ImageDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["linkClass"] === "undefined" || typeof typedObj["linkClass"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["aspectRatio"] === "undefined" ||
      typeof typedObj["aspectRatio"] === "string") &&
    (typeof typedObj["scale"] === "undefined" || typeof typedObj["scale"] === "string") &&
    (typeof typedObj["sizeSlug"] === "undefined" || typeof typedObj["sizeSlug"] === "string") &&
    (typeof typedObj["linkDestination"] === "undefined" ||
      typeof typedObj["linkDestination"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
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

export function isImageDeprecated3Attributes(obj: unknown): obj is ImageDeprecated3Attributes {
  const typedObj = obj as ImageDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["linkClass"] === "undefined" || typeof typedObj["linkClass"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["aspectRatio"] === "undefined" ||
      typeof typedObj["aspectRatio"] === "string") &&
    (typeof typedObj["scale"] === "undefined" || typeof typedObj["scale"] === "string") &&
    (typeof typedObj["sizeSlug"] === "undefined" || typeof typedObj["sizeSlug"] === "string") &&
    (typeof typedObj["linkDestination"] === "undefined" ||
      typeof typedObj["linkDestination"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["borderColor"] === "undefined" ||
      typeof typedObj["borderColor"] === "string") &&
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

export function isImageDeprecated4Attributes(obj: unknown): obj is ImageDeprecated4Attributes {
  const typedObj = obj as ImageDeprecated4Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["linkClass"] === "undefined" || typeof typedObj["linkClass"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["sizeSlug"] === "undefined" || typeof typedObj["sizeSlug"] === "string") &&
    (typeof typedObj["linkDestination"] === "undefined" ||
      typeof typedObj["linkDestination"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
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

export function isImageDeprecated5Attributes(obj: unknown): obj is ImageDeprecated5Attributes {
  const typedObj = obj as ImageDeprecated5Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || typeof typedObj["caption"] === "string") &&
    (typeof typedObj["title"] === "undefined" || typeof typedObj["title"] === "string") &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["rel"] === "undefined" || typeof typedObj["rel"] === "string") &&
    (typeof typedObj["linkClass"] === "undefined" || typeof typedObj["linkClass"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["sizeSlug"] === "undefined" || typeof typedObj["sizeSlug"] === "string") &&
    (typeof typedObj["linkDestination"] === "undefined" ||
      typeof typedObj["linkDestination"] === "string") &&
    (typeof typedObj["linkTarget"] === "undefined" || typeof typedObj["linkTarget"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isImageDeprecated6Attributes(obj: unknown): obj is ImageDeprecated6Attributes {
  const typedObj = obj as ImageDeprecated6Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || Array.isArray(typedObj["caption"])) &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    typeof typedObj["linkDestination"] === "string" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isImageDeprecated7Attributes(obj: unknown): obj is ImageDeprecated7Attributes {
  const typedObj = obj as ImageDeprecated7Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || Array.isArray(typedObj["caption"])) &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isImageDeprecated8Attributes(obj: unknown): obj is ImageDeprecated8Attributes {
  const typedObj = obj as ImageDeprecated8Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["url"] === "undefined" || typeof typedObj["url"] === "string") &&
    typeof typedObj["alt"] === "string" &&
    (typeof typedObj["caption"] === "undefined" || Array.isArray(typedObj["caption"])) &&
    (typeof typedObj["href"] === "undefined" || typeof typedObj["href"] === "string") &&
    (typeof typedObj["id"] === "undefined" || typeof typedObj["id"] === "number") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["height"] === "undefined" || typeof typedObj["height"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isListDeprecated1Attributes(obj: unknown): obj is ListDeprecated1Attributes {
  const typedObj = obj as ListDeprecated1Attributes
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

export function isListDeprecated2Attributes(obj: unknown): obj is ListDeprecated2Attributes {
  const typedObj = obj as ListDeprecated2Attributes
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

export function isListDeprecated3Attributes(obj: unknown): obj is ListDeprecated3Attributes {
  const typedObj = obj as ListDeprecated3Attributes
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

export function isListDeprecated4Attributes(obj: unknown): obj is ListDeprecated4Attributes {
  const typedObj = obj as ListDeprecated4Attributes
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

export function isParagraphDeprecated1Attributes(
  obj: unknown,
): obj is ParagraphDeprecated1Attributes {
  const typedObj = obj as ParagraphDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customFontSize"] === "undefined" ||
      typeof typedObj["customFontSize"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isParagraphDeprecated2Attributes(
  obj: unknown,
): obj is ParagraphDeprecated2Attributes {
  const typedObj = obj as ParagraphDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customFontSize"] === "undefined" ||
      typeof typedObj["customFontSize"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isParagraphDeprecated3Attributes(
  obj: unknown,
): obj is ParagraphDeprecated3Attributes {
  const typedObj = obj as ParagraphDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customFontSize"] === "undefined" ||
      typeof typedObj["customFontSize"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isParagraphDeprecated4Attributes(
  obj: unknown,
): obj is ParagraphDeprecated4Attributes {
  const typedObj = obj as ParagraphDeprecated4Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["customBackgroundColor"] === "undefined" ||
      typeof typedObj["customBackgroundColor"] === "string") &&
    (typeof typedObj["customFontSize"] === "undefined" ||
      typeof typedObj["customFontSize"] === "number") &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isParagraphDeprecated5Attributes(
  obj: unknown,
): obj is ParagraphDeprecated5Attributes {
  const typedObj = obj as ParagraphDeprecated5Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "number") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isParagraphDeprecated6Attributes(
  obj: unknown,
): obj is ParagraphDeprecated6Attributes {
  const typedObj = obj as ParagraphDeprecated6Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["content"] === "string" &&
    typeof typedObj["dropCap"] === "boolean" &&
    (typeof typedObj["placeholder"] === "undefined" ||
      typeof typedObj["placeholder"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["backgroundColor"] === "undefined" ||
      typeof typedObj["backgroundColor"] === "string") &&
    (typeof typedObj["fontSize"] === "undefined" || typeof typedObj["fontSize"] === "string") &&
    (typeof typedObj["direction"] === "undefined" ||
      typedObj["direction"] === "ltr" ||
      typedObj["direction"] === "rtl") &&
    (typeof typedObj["style"] === "undefined" ||
      (((typedObj["style"] !== null && typeof typedObj["style"] === "object") ||
        typeof typedObj["style"] === "function") &&
        Object.entries<any>(typedObj["style"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteDeprecated1Attributes(
  obj: unknown,
): obj is PullquoteDeprecated1Attributes {
  const typedObj = obj as PullquoteDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteDeprecated2Attributes(
  obj: unknown,
): obj is PullquoteDeprecated2Attributes {
  const typedObj = obj as PullquoteDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["mainColor"] === "undefined" || typeof typedObj["mainColor"] === "string") &&
    (typeof typedObj["customMainColor"] === "undefined" ||
      typeof typedObj["customMainColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteDeprecated3Attributes(
  obj: unknown,
): obj is PullquoteDeprecated3Attributes {
  const typedObj = obj as PullquoteDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["mainColor"] === "undefined" || typeof typedObj["mainColor"] === "string") &&
    (typeof typedObj["customMainColor"] === "undefined" ||
      typeof typedObj["customMainColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["figureStyle"] === "undefined" ||
      (((typedObj["figureStyle"] !== null && typeof typedObj["figureStyle"] === "object") ||
        typeof typedObj["figureStyle"] === "function") &&
        Object.entries<any>(typedObj["figureStyle"]).every(
          ([key, _value]) => typeof key === "string",
        ))) &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteDeprecated4Attributes(
  obj: unknown,
): obj is PullquoteDeprecated4Attributes {
  const typedObj = obj as PullquoteDeprecated4Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["mainColor"] === "undefined" || typeof typedObj["mainColor"] === "string") &&
    (typeof typedObj["customMainColor"] === "undefined" ||
      typeof typedObj["customMainColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteDeprecated5Attributes(
  obj: unknown,
): obj is PullquoteDeprecated5Attributes {
  const typedObj = obj as PullquoteDeprecated5Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["mainColor"] === "undefined" || typeof typedObj["mainColor"] === "string") &&
    (typeof typedObj["customMainColor"] === "undefined" ||
      typeof typedObj["customMainColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isPullquoteDeprecated6Attributes(
  obj: unknown,
): obj is PullquoteDeprecated6Attributes {
  const typedObj = obj as PullquoteDeprecated6Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["value"] === "undefined" || typeof typedObj["value"] === "string") &&
    (typeof typedObj["citation"] === "undefined" || typeof typedObj["citation"] === "string") &&
    (typeof typedObj["mainColor"] === "undefined" || typeof typedObj["mainColor"] === "string") &&
    (typeof typedObj["customMainColor"] === "undefined" ||
      typeof typedObj["customMainColor"] === "string") &&
    (typeof typedObj["textColor"] === "undefined" || typeof typedObj["textColor"] === "string") &&
    (typeof typedObj["customTextColor"] === "undefined" ||
      typeof typedObj["customTextColor"] === "string") &&
    typeof typedObj["align"] === "string" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isQuoteDeprecated1Attributes(obj: unknown): obj is QuoteDeprecated1Attributes {
  const typedObj = obj as QuoteDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["value"] === "string" &&
    typeof typedObj["citation"] === "string" &&
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
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isQuoteDeprecated2Attributes(obj: unknown): obj is QuoteDeprecated2Attributes {
  const typedObj = obj as QuoteDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["value"] === "string" &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["anchor"] === "undefined" || typeof typedObj["anchor"] === "string") &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
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

export function isQuoteDeprecated3Attributes(obj: unknown): obj is QuoteDeprecated3Attributes {
  const typedObj = obj as QuoteDeprecated3Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["value"] === "string" &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isQuoteDeprecated4Attributes(obj: unknown): obj is QuoteDeprecated4Attributes {
  const typedObj = obj as QuoteDeprecated4Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["value"] === "string" &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["style"] === "number" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isQuoteDeprecated5Attributes(obj: unknown): obj is QuoteDeprecated5Attributes {
  const typedObj = obj as QuoteDeprecated5Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["value"] === "string" &&
    typeof typedObj["citation"] === "string" &&
    (typeof typedObj["align"] === "undefined" || typeof typedObj["align"] === "string") &&
    typeof typedObj["style"] === "number" &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isSeparatorDeprecated1Attributes(
  obj: unknown,
): obj is SeparatorDeprecated1Attributes {
  const typedObj = obj as SeparatorDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    (typeof typedObj["color"] === "undefined" || typeof typedObj["color"] === "string") &&
    (typeof typedObj["customColor"] === "undefined" ||
      typeof typedObj["customColor"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isSpacerDeprecated1Attributes(obj: unknown): obj is SpacerDeprecated1Attributes {
  const typedObj = obj as SpacerDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["height"] === "number" &&
    (typeof typedObj["width"] === "undefined" || typeof typedObj["width"] === "number") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}

export function isVerseDeprecated1Attributes(obj: unknown): obj is VerseDeprecated1Attributes {
  const typedObj = obj as VerseDeprecated1Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["content"] === "string" &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
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

export function isVerseDeprecated2Attributes(obj: unknown): obj is VerseDeprecated2Attributes {
  const typedObj = obj as VerseDeprecated2Attributes
  return (
    ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
    typeof typedObj["content"] === "string" &&
    (typeof typedObj["textAlign"] === "undefined" || typeof typedObj["textAlign"] === "string") &&
    (typeof typedObj["lock"] === "undefined" ||
      (((typedObj["lock"] !== null && typeof typedObj["lock"] === "object") ||
        typeof typedObj["lock"] === "function") &&
        Object.entries<any>(typedObj["lock"]).every(([key, _value]) => typeof key === "string"))) &&
    (typeof typedObj["className"] === "undefined" || typeof typedObj["className"] === "string") &&
    (typeof typedObj["metadata"] === "undefined" ||
      (((typedObj["metadata"] !== null && typeof typedObj["metadata"] === "object") ||
        typeof typedObj["metadata"] === "function") &&
        Object.entries<any>(typedObj["metadata"]).every(
          ([key, _value]) => typeof key === "string",
        )))
  )
}
