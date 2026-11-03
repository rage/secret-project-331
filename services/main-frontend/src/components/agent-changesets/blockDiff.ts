import { diffArrays } from "diff"
import { isEqual } from "lodash"

import type { Block } from "@/types/courseMaterialBlock"

type AnyBlock = Block<unknown>

/** Which side of a change a review tab shows: both marked inline, or one of them. */
export const DIFF_SIDE = {
  CHANGES: "changes",
  BEFORE: "before",
  AFTER: "after",
} as const

export type DiffSide = (typeof DIFF_SIDE)[keyof typeof DIFF_SIDE]

/**
 * A top-level block in the merged before/after order. A block that moved shows up twice: as
 * `moved-away` where it was and as `moved` where it is now.
 */
export type BlockDiffRow =
  | { kind: "unchanged"; before: AnyBlock; after: AnyBlock }
  | { kind: "changed"; before: AnyBlock; after: AnyBlock }
  | { kind: "added"; after: AnyBlock }
  | { kind: "removed"; before: AnyBlock }
  | { kind: "moved"; before: AnyBlock; after: AnyBlock }
  | { kind: "moved-away"; before: AnyBlock; after: AnyBlock }

/** Rows a tab shows, with runs of unchanged blocks folded into one entry. */
export type VisibleDiffRow = Exclude<BlockDiffRow, { kind: "unchanged" }> | UnchangedRun

export interface UnchangedRun {
  kind: "unchanged-run"
  /** The blocks of the side the tab shows, in order. */
  blocks: AnyBlock[]
}

/**
 * Pairs a page's top-level blocks before and after a change by `clientId`. Blocks keep their
 * position when they are in the longest common subsequence of ids; the rest of the shared ids moved.
 */
export function diffBlockLists(before: AnyBlock[], after: AnyBlock[]): BlockDiffRow[] {
  const beforeById = new Map(before.map((block) => [block.clientId, block]))
  const afterById = new Map(after.map((block) => [block.clientId, block]))
  const rows: BlockDiffRow[] = []
  const parts = diffArrays(
    before.map((block) => block.clientId),
    after.map((block) => block.clientId),
  )
  for (const part of parts) {
    for (const id of part.value) {
      const beforeBlock = beforeById.get(id)
      const afterBlock = afterById.get(id)
      if (part.removed) {
        rows.push(
          afterBlock
            ? { kind: "moved-away", before: beforeBlock as AnyBlock, after: afterBlock }
            : { kind: "removed", before: beforeBlock as AnyBlock },
        )
      } else if (part.added) {
        rows.push(
          beforeBlock
            ? { kind: "moved", before: beforeBlock, after: afterBlock as AnyBlock }
            : { kind: "added", after: afterBlock as AnyBlock },
        )
      } else {
        const pair = { before: beforeBlock as AnyBlock, after: afterBlock as AnyBlock }
        rows.push({ kind: isEqual(pair.before, pair.after) ? "unchanged" : "changed", ...pair })
      }
    }
  }
  return rows
}

function isShownOn(row: BlockDiffRow, side: DiffSide): boolean {
  switch (row.kind) {
    case "added":
      return side !== "before"
    case "removed":
      return side !== "after"
    case "moved":
      return side !== "before"
    case "moved-away":
      return side === "before"
    default:
      return true
  }
}

/** The rows a tab shows, unchanged blocks folded into runs. */
export function visibleRows(rows: BlockDiffRow[], side: DiffSide): VisibleDiffRow[] {
  const visible: VisibleDiffRow[] = []
  for (const row of rows) {
    if (!isShownOn(row, side)) {
      continue
    }
    if (row.kind !== "unchanged") {
      visible.push(row)
      continue
    }
    const block = side === "before" ? row.before : row.after
    const last = visible.at(-1)
    if (last?.kind === "unchanged-run") {
      last.blocks.push(block)
    } else {
      visible.push({ kind: "unchanged-run", blocks: [block] })
    }
  }
  return visible
}

/** Whether a moved block's content also changed. */
export function isContentChanged(row: { before: AnyBlock; after: AnyBlock }): boolean {
  return !isEqual(row.before, row.after)
}

const TAG = /(<[^>]*>)/
// Shortcodes the course material renderer replaces whole; markup inside them would break them.
const TEXT_TOKEN =
  /\[latex\].*?\[\/latex\]|\\cite(?:\[[^\]]*\])*\{.*?\}|&[#a-zA-Z0-9]+;|\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_&[\\]+|./gsu

function tokenize(text: string): string[] {
  return text.match(TEXT_TOKEN) ?? []
}

function markTextSegment(before: string, after: string, side: DiffSide): string {
  const del = (text: string) => (text !== "" && side !== "after" ? `<del>${text}</del>` : "")
  const ins = (text: string) => (text !== "" && side !== "before" ? `<ins>${text}</ins>` : "")
  const parts = diffArrays(tokenize(before), tokenize(after))
  let marked = ""
  let removed = ""
  let added = ""
  const flush = () => {
    marked += del(removed) + ins(added)
    removed = ""
    added = ""
  }
  parts.forEach((part, index) => {
    const text = part.value.join("")
    if (part.removed) {
      removed += text
    } else if (part.added) {
      added += text
    } else {
      const next = parts[index + 1]
      // "<del>a b</del><ins>x y</ins>" reads better than four marks around a kept space.
      const isSpaceInsideReplacement =
        removed !== "" &&
        added !== "" &&
        /^\s+$/.test(text) &&
        next !== undefined &&
        (next.added || next.removed)
      if (isSpaceInsideReplacement) {
        removed += text
        added += text
        return
      }
      flush()
      marked += text
    }
  })
  flush()
  return marked
}

/**
 * Marks word-level differences between two HTML strings with `<del>` and `<ins>`, leaving the
 * markup as it is. Returns `null` when the markup differs, as words can't then be marked without
 * risking broken HTML.
 */
export function markTextChanges(before: string, after: string, side: DiffSide): string | null {
  const beforeSegments = before.split(TAG)
  const afterSegments = after.split(TAG)
  if (beforeSegments.length !== afterSegments.length) {
    return null
  }
  let marked = ""
  for (let i = 0; i < beforeSegments.length; i++) {
    const beforeSegment = beforeSegments[i] ?? ""
    const afterSegment = afterSegments[i] ?? ""
    // split with a capturing group puts the tags at odd indices.
    if (i % 2 === 1) {
      if (beforeSegment !== afterSegment) {
        return null
      }
      marked += afterSegment
    } else {
      marked += markTextSegment(beforeSegment, afterSegment, side)
    }
  }
  return marked
}

/**
 * Attributes the course material renderer shows as HTML, per block. Others may be shown as plain
 * text or not be text at all, so `<ins>` and `<del>` can't go in them. In nested values, only
 * `content` strings are text, as in table cells.
 */
const RICH_TEXT_ATTRIBUTES: Record<string, string[]> = {
  "core/paragraph": ["content"],
  "core/heading": ["content"],
  "core/list": ["values"],
  "core/list-item": ["content"],
  "core/image": ["caption"],
  "core/quote": ["citation"],
  "core/pullquote": ["value", "citation"],
  "core/verse": ["content"],
  "core/preformatted": ["content"],
  "core/button": ["text"],
  "core/table": ["caption", "head", "body", "foot"],
  "core/audio": ["caption"],
  "core/video": ["caption"],
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** `undefined` when the values differ in a way words can't be marked in. */
function markValue(before: unknown, after: unknown, isText: boolean, side: DiffSide): unknown {
  if (isEqual(before, after)) {
    return side === "before" ? before : after
  }
  if (typeof before === "string" && typeof after === "string") {
    return isText ? (markTextChanges(before, after, side) ?? undefined) : undefined
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) {
      return undefined
    }
    const marked = before.map((item, i) => markValue(item, after[i], false, side))
    return marked.includes(undefined) ? undefined : marked
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const marked: Record<string, unknown> = {}
    for (const key of keys) {
      const value = markValue(before[key], after[key], key === "content", side)
      if (value === undefined && (before[key] !== undefined || after[key] !== undefined)) {
        return undefined
      }
      marked[key] = value
    }
    return marked
  }
  return undefined
}

/**
 * The block with its text differences marked for the given side, or `null` when the change is
 * more than text in the same markup: another block type, other non-text attributes or inner blocks.
 */
export function markBlockChanges(
  before: AnyBlock,
  after: AnyBlock,
  side: DiffSide,
): AnyBlock | null {
  if (before.name !== after.name || before.innerBlocks.length !== after.innerBlocks.length) {
    return null
  }
  const richTextAttributes = RICH_TEXT_ATTRIBUTES[after.name] ?? []
  const beforeAttributes = isPlainObject(before.attributes) ? before.attributes : {}
  const afterAttributes = isPlainObject(after.attributes) ? after.attributes : {}
  const attributes: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(beforeAttributes), ...Object.keys(afterAttributes)])) {
    const beforeValue = beforeAttributes[key]
    const afterValue = afterAttributes[key]
    const marked = isEqual(beforeValue, afterValue)
      ? side === "before"
        ? beforeValue
        : afterValue
      : richTextAttributes.includes(key)
        ? markValue(beforeValue, afterValue, true, side)
        : undefined
    if (marked === undefined && (beforeValue !== undefined || afterValue !== undefined)) {
      return null
    }
    attributes[key] = marked
  }
  const innerBlocks: AnyBlock[] = []
  for (const [i, afterInner] of after.innerBlocks.entries()) {
    const beforeInner = before.innerBlocks[i]
    if (beforeInner === undefined || beforeInner.clientId !== afterInner.clientId) {
      return null
    }
    const marked = markBlockChanges(beforeInner, afterInner, side)
    if (marked === null) {
      return null
    }
    innerBlocks.push(marked)
  }
  return { ...(side === "before" ? before : after), attributes, innerBlocks }
}
