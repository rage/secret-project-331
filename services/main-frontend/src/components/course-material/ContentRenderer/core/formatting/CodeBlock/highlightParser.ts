/**
 * Parser for comment-based line highlighting in code blocks.
 * Supports // highlight-line, // highlight-start, // highlight-end.
 */

export interface ProcessedCodeData {
  cleanCode: string
  highlightedLines: Set<number>
}

const MARKER_LINE = "// highlight-line"
const MARKER_START = "// highlight-start"
const MARKER_END = "// highlight-end"

/**
 * Returns true if the line is the start or end marker with optional surrounding whitespace.
 */
function isStandaloneMarker(line: string, marker: string): boolean {
  const t = line.trim()
  return t === marker || (t.startsWith(marker) && t.slice(marker.length).trim() === "")
}

/**
 * Strips trailing "// highlight-line" from a line if present. Returns the cleaned line and whether it was present.
 * Requires whitespace (space or tab) before the marker so e.g. "http:// highlight-line" in a string is not stripped.
 */
function stripHighlightLineMarker(line: string): { cleaned: string; hadMarker: boolean } {
  const trimmed = line.trimEnd()
  const marker = MARKER_LINE
  if (trimmed.endsWith(marker)) {
    const before = trimmed.slice(0, trimmed.length - marker.length)
    if (
      before.length > 0 &&
      before[before.length - 1] !== " " &&
      before[before.length - 1] !== "\t"
    ) {
      return { cleaned: line, hadMarker: false }
    }
    return { cleaned: before.trimEnd(), hadMarker: true }
  }
  return { cleaned: line, hadMarker: false }
}

/**
 * Parses code content for highlight markers and returns clean code plus 1-indexed line numbers to highlight.
 *
 * Supported markers (JavaScript/TypeScript style only):
 * - "// highlight-line" (at end of line) - highlights that line
 * - "// highlight-start" (standalone line) - begins highlight range
 * - "// highlight-end" (standalone line) - ends highlight range
 *
 * Note: Only "//" comment markers are supported. Other languages (Python "#", etc.) are not supported.
 * Marker-only lines are replaced with empty lines to preserve line count.
 *
 * @param content - The code content to parse
 * @returns Object with cleanCode (markers removed) and highlightedLines (1-indexed Set)
 */
export function parseHighlightedCode(content: string | null | undefined): ProcessedCodeData {
  if (content == null || content === "") {
    return { cleanCode: content ?? "", highlightedLines: new Set() }
  }

  const lines = content.split("\n")
  const cleanLines: string[] = []
  const highlightedLines = new Set<number>()
  let rangeLevel = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isStandaloneMarker(line, MARKER_START)) {
      rangeLevel += 1
      continue
    }

    if (isStandaloneMarker(line, MARKER_END)) {
      rangeLevel = Math.max(0, rangeLevel - 1)
      continue
    }

    const { cleaned, hadMarker } = stripHighlightLineMarker(line)
    cleanLines.push(cleaned)
    const lineNum = cleanLines.length

    if (hadMarker) {
      highlightedLines.add(lineNum)
    }
    if (rangeLevel > 0) {
      highlightedLines.add(lineNum)
    }
  }

  return {
    cleanCode: cleanLines.join("\n"),
    highlightedLines,
  }
}
