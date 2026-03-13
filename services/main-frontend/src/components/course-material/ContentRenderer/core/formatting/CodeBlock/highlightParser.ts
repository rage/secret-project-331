/**
 * Parser for comment-based line highlighting in code blocks.
 * Supports both slash style (// HIGHLIGHT LINE, // BEGIN HIGHLIGHT, // END HIGHLIGHT)
 * and hash style (# HIGHLIGHT LINE, # BEGIN HIGHLIGHT, # END HIGHLIGHT) in the same block,
 * so highlighting works regardless of block language or missing language.
 */

export interface ProcessedCodeData {
  cleanCode: string
  highlightedLines: Set<number>
}

interface MarkerSet {
  line: string
  start: string
  end: string
}

const SLASH_MARKERS: MarkerSet = {
  line: "// HIGHLIGHT LINE",
  start: "// BEGIN HIGHLIGHT",
  end: "// END HIGHLIGHT",
}

const HASH_MARKERS: MarkerSet = {
  line: "# HIGHLIGHT LINE",
  start: "# BEGIN HIGHLIGHT",
  end: "# END HIGHLIGHT",
}

const MARKER_SETS = [SLASH_MARKERS, HASH_MARKERS]

/**
 * Returns true if the line is the start or end marker with optional surrounding whitespace.
 */
function isStandaloneMarker(line: string, marker: string): boolean {
  const t = line.trim()
  return t === marker || (t.startsWith(marker) && t.slice(marker.length).trim() === "")
}

/**
 * Strips trailing line-highlight marker from a line if present. Returns the cleaned line and whether it was present.
 * Requires whitespace (space or tab) before the marker so e.g. "http:// ..." or "key# ..." in strings are not stripped.
 */
function stripHighlightLineMarker(
  line: string,
  markerLine: string,
): { cleaned: string; hadMarker: boolean } {
  const trimmed = line.trimEnd()
  if (trimmed.endsWith(markerLine)) {
    const before = trimmed.slice(0, trimmed.length - markerLine.length)
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
 * Recognizes both // and # marker styles in the same block so language need not be detected.
 *
 * Expects content with real newlines (`\n`). If the source uses `<br>` (e.g. Gutenberg), run
 * replaceBrTagsWithNewlines before calling this. Escaped br (e.g. `&lt;br&gt;`) is never treated as a newline.
 *
 * Supported markers (both styles apply):
 * - "// HIGHLIGHT LINE" or "# HIGHLIGHT LINE" (at end of line, with whitespace before comment) - highlights that line
 * - "// BEGIN HIGHLIGHT" or "# BEGIN HIGHLIGHT" (standalone line) - begins highlight range
 * - "// END HIGHLIGHT" or "# END HIGHLIGHT" (standalone line) - ends highlight range
 *
 * Marker-only lines (start/end) are omitted from output so copy and display match.
 *
 * @param content - The code content to parse (use newlines; normalize br upstream if needed)
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

    let isStandalone = false
    for (const markers of MARKER_SETS) {
      if (isStandaloneMarker(line, markers.start)) {
        rangeLevel += 1
        isStandalone = true
        break
      }
      if (isStandaloneMarker(line, markers.end)) {
        rangeLevel = Math.max(0, rangeLevel - 1)
        isStandalone = true
        break
      }
    }
    if (isStandalone) {
      continue
    }

    let cleaned = line
    let hadMarker = false
    for (const markers of MARKER_SETS) {
      const result = stripHighlightLineMarker(cleaned, markers.line)
      if (result.hadMarker) {
        cleaned = result.cleaned
        hadMarker = true
        break
      }
    }

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
