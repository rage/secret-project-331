import { decodeHtmlEntities } from "./htmlEntities"

/**
 * The text of a rich-text value, for an attribute or a label that can't hold markup: tags are
 * dropped and character references decoded. Gives the same result on the server and in the
 * browser, so it is safe to render during hydration.
 */
export const richTextToPlainText = (html: string): string =>
  decodeHtmlEntities(html.replaceAll(/<[^>]*>/g, "")).trim()
