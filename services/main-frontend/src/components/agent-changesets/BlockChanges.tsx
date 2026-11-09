"use client"

import { css, cx } from "@emotion/css"
import React, { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"
import type { Block } from "@/types/courseMaterialBlock"

import {
  DIFF_SIDE,
  type DiffSide,
  diffBlockLists,
  isContentChanged,
  markBlockChanges,
  type VisibleDiffRow,
  visibleRows,
} from "./blockDiff"

/** Which version of the content blocks come from, for blocks that read their page. */
export type BlocksVersion = typeof DIFF_SIDE.BEFORE | typeof DIFF_SIDE.AFTER

const listCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;

  ins {
    color: ${baseTheme.colors.green[800]};
    background: ${baseTheme.colors.green[100]};
  }

  del {
    color: ${baseTheme.colors.red[800]};
    background: ${baseTheme.colors.red[100]};
  }
`

const markedBlockCss = css`
  border-left: 3px solid ${baseTheme.colors.gray[200]};
  padding-left: 0.75rem;
`

const addedBlockCss = css`
  border-left-color: ${baseTheme.colors.green[600]};
`

const removedBlockCss = css`
  border-left-color: ${baseTheme.colors.red[600]};
`

const fadedCss = css`
  opacity: 0.6;
`

const labelCss = css`
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[600]};
`

const MARK = {
  ADDED: "added",
  REMOVED: "removed",
  MOVED: "moved",
  CHANGED: "changed",
} as const

type BlockMark = (typeof MARK)[keyof typeof MARK]

// The alt text after the slash keeps screen readers from reading the symbol.
const symbolCss = (symbol: string) => css`
  &::before {
    content: "${symbol} " / "";
  }
`

interface MarkedBlockProps {
  marks: BlockMark[]
  children: React.ReactNode
}

const MarkedBlock: React.FC<MarkedBlockProps> = ({ marks, children }) => {
  const { t } = useTranslation()
  const isAdded = marks.includes(MARK.ADDED)
  const isRemoved = marks.includes(MARK.REMOVED)
  const label = (mark: BlockMark): React.ReactNode => {
    switch (mark) {
      case MARK.ADDED:
        return (
          <span
            className={cx(
              symbolCss("+"),
              css`
                color: ${baseTheme.colors.green[700]};
              `,
            )}
          >
            {t("agent-block-added")}
          </span>
        )
      case MARK.REMOVED:
        return (
          <span
            className={cx(
              symbolCss("−"),
              css`
                color: ${baseTheme.colors.red[700]};
              `,
            )}
          >
            {t("agent-block-removed")}
          </span>
        )
      case MARK.MOVED:
        return t("agent-block-moved")
      case MARK.CHANGED:
        return t("agent-block-changed")
    }
  }
  return (
    <div
      data-testid={`agent-block-${marks.join("-")}`}
      className={cx(markedBlockCss, isAdded && addedBlockCss, isRemoved && removedBlockCss)}
    >
      <p className={labelCss}>
        {marks.map((mark, index) => (
          <React.Fragment key={mark}>
            {index > 0 && ", "}
            {label(mark)}
          </React.Fragment>
        ))}
      </p>
      <div className={cx(isRemoved && fadedCss)}>{children}</div>
    </div>
  )
}

interface UnchangedBlocksProps {
  blocks: Block<unknown>[]
  render: (blocks: Block<unknown>[]) => React.ReactNode
}

const UnchangedBlocks: React.FC<UnchangedBlocksProps> = ({ blocks, render }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = useId()
  return (
    <div data-testid="agent-unchanged-blocks">
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: ${baseTheme.colors.gray[600]};
          border-top: 1px dashed ${baseTheme.colors.gray[200]};
          border-bottom: 1px dashed ${baseTheme.colors.gray[200]};
          padding: 0.25rem 0;
        `}
      >
        <span className={symbolCss("⋯")}>
          {t("agent-unchanged-blocks", { count: blocks.length })}
        </span>
        <Button
          variant="tertiary"
          size="small"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t("agent-hide-unchanged-blocks") : t("agent-show-unchanged-blocks")}
        </Button>
      </div>
      <div id={contentId}>{isExpanded && render(blocks)}</div>
    </div>
  )
}

interface BlockChangesProps {
  before: Block<unknown>[]
  after: Block<unknown>[]
  side: DiffSide
  /** Renders blocks as on the course page; `version` tells which side's page they belong to. */
  renderBlocks: (blocks: Block<unknown>[], version: BlocksVersion) => React.ReactNode
}

/**
 * Only the top-level blocks a change touches, rendered as on the course page with changed words
 * marked; unchanged blocks between them fold into expandable runs.
 */
const BlockChanges: React.FC<BlockChangesProps> = ({ before, after, side, renderBlocks }) => {
  const rows = useMemo(
    () => visibleRows(diffBlockLists(before, after), side),
    [before, after, side],
  )
  const version: BlocksVersion = side === DIFF_SIDE.BEFORE ? DIFF_SIDE.BEFORE : DIFF_SIDE.AFTER
  const ofVersion = (row: { before: Block<unknown>; after: Block<unknown> }) =>
    version === DIFF_SIDE.BEFORE ? row.before : row.after
  const added = (block: Block<unknown>) => (
    <MarkedBlock marks={[MARK.ADDED]}>{renderBlocks([block], DIFF_SIDE.AFTER)}</MarkedBlock>
  )
  const removed = (block: Block<unknown>) => (
    <MarkedBlock marks={[MARK.REMOVED]}>{renderBlocks([block], DIFF_SIDE.BEFORE)}</MarkedBlock>
  )

  const renderRow = (row: VisibleDiffRow): React.ReactNode => {
    switch (row.kind) {
      case "unchanged-run":
        return (
          <UnchangedBlocks blocks={row.blocks} render={(blocks) => renderBlocks(blocks, version)} />
        )
      case "added":
        return added(row.after)
      case "removed":
        return removed(row.before)
      case "moved":
      case "moved-away": {
        const marked = isContentChanged(row) ? markBlockChanges(row.before, row.after, side) : null
        return (
          <MarkedBlock
            marks={marked || !isContentChanged(row) ? [MARK.MOVED] : [MARK.MOVED, MARK.CHANGED]}
          >
            {renderBlocks([marked ?? ofVersion(row)], version)}
          </MarkedBlock>
        )
      }
      case "changed": {
        const marked = markBlockChanges(row.before, row.after, side)
        if (marked) {
          return renderBlocks([marked], version)
        }
        if (side === DIFF_SIDE.CHANGES) {
          return (
            <>
              {removed(row.before)}
              {added(row.after)}
            </>
          )
        }
        return (
          <MarkedBlock marks={[MARK.CHANGED]}>
            {renderBlocks([ofVersion(row)], version)}
          </MarkedBlock>
        )
      }
    }
  }

  return (
    <div className={listCss}>
      {rows.map((row, index) => (
        <React.Fragment key={row.kind === "unchanged-run" ? `run-${index}` : rowKey(row)}>
          {renderRow(row)}
        </React.Fragment>
      ))}
    </div>
  )
}

function rowKey(row: Exclude<VisibleDiffRow, { kind: "unchanged-run" }>): string {
  return `${row.kind}-${"after" in row ? row.after.clientId : row.before.clientId}`
}

export default BlockChanges
