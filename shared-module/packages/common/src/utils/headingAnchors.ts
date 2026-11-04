const MAX_SLUG_LENGTH = 80
const FALLBACK_SLUG = "heading"

/** How much of a block's client id goes into a heading's anchor. */
export const HEADING_ANCHOR_ID_PART_LENGTH = 8

const ID_PART_PATTERN = new RegExp(`^[0-9a-f]{${HEADING_ANCHOR_ID_PART_LENGTH}}(?=-)`)

/** Letters that NFD leaves intact but that have an established ASCII spelling. */
const NON_DECOMPOSABLE_LETTERS: Record<string, string> = {
  ß: "ss",
  ø: "o",
  æ: "ae",
  œ: "oe",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
  ŋ: "ng",
  ŧ: "t",
  ı: "i",
}

/** Dropped rather than treated as a separator, so that contractions stay a single word. */
const APOSTROPHES = /['‘’ʼ´`]/g

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

/**
 * Extracts the readable text of a heading from the HTML Gutenberg stored for it.
 *
 * Deliberately string-only rather than DOM-based: the same heading is slugified during server
 * rendering and again in the browser, and any disagreement between the two would both break
 * hydration and make a shared link resolve differently depending on where it was generated.
 */
export function headingTextFromHtml(html: string | undefined): string {
  if (!html) {
    return ""
  }
  // Only line breaks separate words; inline formatting can start or end mid-word. A MathML
  // annotation holds the formula's LaTeX source, which is not displayed.
  const withoutTags = html
    .replaceAll(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/gi, "")
    .replaceAll(/<br\b[^>]*>/gi, " ")
    .replaceAll(/<[^>]*>/g, "")
  return decodeEntities(withoutTags).replaceAll(/\s+/g, " ").trim()
}

function decodeEntities(text: string): string {
  return text.replaceAll(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    const lowercased = body.toLowerCase()
    if (lowercased.startsWith("#x")) {
      return codePointToString(Number.parseInt(lowercased.slice(2), 16), entity)
    }
    if (lowercased.startsWith("#")) {
      return codePointToString(Number(lowercased.slice(1)), entity)
    }
    return NAMED_ENTITIES[lowercased] ?? entity
  })
}

/** Falls back to the entity as written when it does not name a usable code point. */
function codePointToString(codePoint: number, original: string): string {
  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return original
  }
}

const LATIN_LETTER = /\p{Script=Latin}/u
const COMBINING_MARK = /\p{M}/u

/**
 * Folds Latin letters to ASCII and leaves every other script as it is. Marks are dropped only from
 * Latin letters: in scripts such as Devanagari they are part of the spelling.
 */
function foldLatinToAscii(text: string): string {
  let folded = ""
  let afterLatinLetter = false
  for (const character of text.normalize("NFD")) {
    if (COMBINING_MARK.test(character)) {
      if (!afterLatinLetter) {
        folded += character
      }
      continue
    }
    afterLatinLetter = LATIN_LETTER.test(character)
    folded += afterLatinLetter
      ? (NON_DECOMPOSABLE_LETTERS[character.toLowerCase()] ?? character)
      : character
  }
  return folded.normalize("NFC")
}

function toKebabCase(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replaceAll(/^-+|-+$/g, "")
}

/** Shortens an over-long slug at a word boundary so the resulting link stays readable. */
function truncate(slug: string): string {
  if (slug.length <= MAX_SLUG_LENGTH) {
    return slug
  }
  const cut = slug.slice(0, MAX_SLUG_LENGTH)
  const lastBoundary = cut.lastIndexOf("-")
  return lastBoundary > 0 ? cut.slice(0, lastBoundary) : cut
}

/**
 * Turns heading text into the readable slug used as the heading's `id`.
 *
 * Accented Latin letters fold to ASCII so that a copied link survives being pasted into chat or
 * email without turning into percent-encoded noise. Scripts that have no ASCII spelling (Cyrillic,
 * Arabic, ...) keep their own letters.
 */
export function slugifyHeadingText(text: string): string {
  const folded = foldLatinToAscii(text.replaceAll(APOSTROPHES, ""))
  const slug = truncate(toKebabCase(folded))
  return slug === "" ? FALLBACK_SLUG : slug
}

/**
 * The leading client id fragment of a heading anchor, or undefined when there is none.
 *
 * Lets a link keep resolving after the heading it points at has been reworded: the readable half of
 * the anchor changes, this half does not. A full client id starts with the same characters, so
 * anchors pointing at a whole block resolve through here too.
 */
export function headingAnchorIdPart(anchor: string): string | undefined {
  return ID_PART_PATTERN.exec(anchor)?.[0]
}
