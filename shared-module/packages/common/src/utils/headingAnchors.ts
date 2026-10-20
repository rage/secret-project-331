const HEADING_BLOCK_NAME = "core/heading"
const MAX_SLUG_LENGTH = 80
const FALLBACK_SLUG = "heading"

/** How much of a block's client id goes into a heading's anchor, before any collision. */
const ID_PART_LENGTH = 8

const ID_PART_PATTERN = new RegExp(`^[0-9a-f]{${ID_PART_LENGTH},}(?=-)`)

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
  const withoutTags = html.replaceAll(/<[^>]*>/g, " ")
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

interface HeadingBlockAttributes {
  content?: string
  anchor?: string
}

/** The parts of a Gutenberg block this module needs. */
export interface HeadingAnchorBlock {
  name: string
  clientId: string
  attributes: unknown
  innerBlocks: HeadingAnchorBlock[]
}

interface CollectedHeading {
  clientId: string
  content: string
  explicitAnchor: string | undefined
}

/** Page content is stored JSON, so entries that are not block objects are skipped. */
function collectHeadings(blocks: readonly unknown[], collected: CollectedHeading[]): void {
  for (const entry of blocks) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const block = entry as HeadingAnchorBlock
    if (block.name === HEADING_BLOCK_NAME) {
      const attributes = block.attributes as HeadingBlockAttributes | undefined
      const explicitAnchor = attributes?.anchor?.trim()
      collected.push({
        clientId: block.clientId,
        content: attributes?.content ?? "",
        explicitAnchor: explicitAnchor === "" ? undefined : explicitAnchor,
      })
    }
    if (Array.isArray(block.innerBlocks)) {
      collectHeadings(block.innerBlocks, collected)
    }
  }
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

function uniqueIdPart(clientId: string, taken: Set<string>): string {
  const withoutDashes = clientId.replaceAll("-", "")
  let length = ID_PART_LENGTH
  while (length < withoutDashes.length && taken.has(withoutDashes.slice(0, length))) {
    length += ID_PART_LENGTH
  }
  return withoutDashes.slice(0, length)
}

/**
 * Resolves the `id` every heading on a page should render, keyed by block client id.
 *
 * Anchors are `<client id fragment>-<readable slug>`. The readable half makes the link worth
 * sharing; the client id half keeps it resolving once the heading has been reworded or moved,
 * since it belongs to the block rather than to its text or position.
 *
 * An author-set HTML anchor replaces the whole thing. Duplicating a heading block copies that
 * attribute along with the rest, so only the first block claiming an anchor keeps it; later ones
 * fall back to their generated anchor rather than rendering a second element with the same id. An
 * author-set anchor that starts with a client id fragment (such as a pasted link) reserves that
 * fragment, so the id part fallback in links cannot match two headings.
 *
 * @param blocks The page's block tree. Inner blocks are walked, so headings nested in columns or
 * expandable content are included.
 */
export function buildHeadingAnchorIds(blocks: HeadingAnchorBlock[]): Map<string, string> {
  const headings: CollectedHeading[] = []
  collectHeadings(blocks, headings)

  const anchorIds = new Map<string, string>()
  const takenAnchors = new Set<string>()
  const takenIdParts = new Set<string>()
  for (const heading of headings) {
    if (heading.explicitAnchor !== undefined && !takenAnchors.has(heading.explicitAnchor)) {
      takenAnchors.add(heading.explicitAnchor)
      anchorIds.set(heading.clientId, heading.explicitAnchor)
      const idPart = headingAnchorIdPart(heading.explicitAnchor)
      if (idPart !== undefined) {
        takenIdParts.add(idPart)
      }
    }
  }

  for (const heading of headings) {
    if (anchorIds.has(heading.clientId)) {
      continue
    }
    const idPart = uniqueIdPart(heading.clientId, takenIdParts)
    takenIdParts.add(idPart)
    const slug = slugifyHeadingText(headingTextFromHtml(heading.content))
    let anchor = `${idPart}-${slug}`
    for (let suffix = 2; takenAnchors.has(anchor); suffix++) {
      anchor = `${idPart}-${slug}-${suffix}`
    }
    takenAnchors.add(anchor)
    anchorIds.set(heading.clientId, anchor)
  }

  return anchorIds
}
