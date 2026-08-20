"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { useSelect } from "@wordpress/data"
import { Fragment, useMemo } from "@wordpress/element"

import type { BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"
import type { HeadingHierarchyIssue } from "./headingHierarchy"
import {
  analyzeHeadingHierarchyForFlatBlocks,
  getHeadingHierarchyIssuesForBlock,
  HEADING_SOURCE_BLOCK_NAMES,
} from "./headingHierarchy"

interface BlockEditWithClientIdProps {
  name: string
  clientId: string
  [key: string]: unknown
}

interface HeadingHierarchySelectors {
  getBlocksByName: (blockName: string[]) => string[]
  getBlock: (clientId: string) => BlockInstance | null
}

// oxlint-disable-next-line i18next/no-literal-string
const W3C_HEADINGS_GUIDANCE_URL = "https://www.w3.org/WAI/test-evaluate/easy-checks/headings/"
const BLOCK_EDITOR_STORE = "core/block-editor"
const WARNING_NOTICE_STATUS = "warning"
const HEADING_SOURCE_BLOCK_NAME_SET = new Set(HEADING_SOURCE_BLOCK_NAMES)
const NO_ISSUES: HeadingHierarchyIssue[] = []
const noticeParagraphClass = css`
  margin: 0 0 0.75rem 0;

  &:last-child {
    margin-bottom: 0;
  }
`

const renderIssueText = (
  issue: HeadingHierarchyIssue,
  t: ReturnType<typeof useTranslation>["t"],
): string => {
  switch (issue.type) {
    case "heading-h1-reserved":
      return t("warning-heading-h1-reserved")
    case "heading-first-should-be-h2":
      return t("warning-heading-first-should-be-h2", { level: issue.level })
    case "heading-level-jump":
      return t("warning-heading-level-jump", {
        fromLevel: issue.previousLevel,
        toLevel: issue.level,
      })
  }
}

const renderGuidanceText = (
  issues: HeadingHierarchyIssue[],
  t: ReturnType<typeof useTranslation>["t"],
): string =>
  issues.some((issue) => issue.type === "heading-level-jump")
    ? t("warning-heading-guidance-gap")
    : t("warning-heading-guidance")

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withHeadingHierarchyWarnings = createHigherOrderComponent((BlockEdit) => {
  const HeadingHierarchyWarnings = (props: BlockEditWithClientIdProps) => {
    const { t } = useTranslation()
    const isPreviewMode = useIsBlockPreviewMode()
    // getBlocksByName is memoized and getBlock hands out stable tree nodes; getBlocks() returns a
    // fresh array instead and would re-render every heading on each keystroke anywhere.
    const headingBlocks = useSelect((select) => {
      const store = select(BLOCK_EDITOR_STORE) as HeadingHierarchySelectors
      return store
        .getBlocksByName(HEADING_SOURCE_BLOCK_NAMES)
        .map((clientId) => store.getBlock(clientId))
        .filter((block): block is BlockInstance => block !== null)
    }, [])

    const issues = useMemo(
      () =>
        isPreviewMode
          ? NO_ISSUES
          : getHeadingHierarchyIssuesForBlock(
              analyzeHeadingHierarchyForFlatBlocks(headingBlocks),
              props.clientId,
            ),
      [isPreviewMode, headingBlocks, props.clientId],
    )

    return (
      <Fragment>
        <BlockEdit {...props} />
        {issues.length > 0 && (
          <div
            className={css`
              margin-top: 0.75rem;
              margin-bottom: 1.25rem;
            `}
          >
            <Notice status={WARNING_NOTICE_STATUS} isDismissible={false}>
              {issues.map((issue, index) => (
                <p
                  key={`${issue.type}-${issue.previousLevel ?? "none"}-${index}`}
                  className={noticeParagraphClass}
                >
                  {renderIssueText(issue, t)}
                </p>
              ))}
              <p className={noticeParagraphClass}>{renderGuidanceText(issues, t)}</p>
              <p className={noticeParagraphClass}>
                <a href={W3C_HEADINGS_GUIDANCE_URL} target="_blank" rel="noopener noreferrer">
                  {t("link-heading-structure-guidance")}
                </a>
              </p>
            </Notice>
          </div>
        )}
      </Fragment>
    )
  }

  // This dispatcher runs for every block in the document; the hooks stay in the inner component so
  // that only heading blocks subscribe to the store.
  const BlockEditWithHeadingWarnings = (props: BlockEditWithClientIdProps) =>
    HEADING_SOURCE_BLOCK_NAME_SET.has(props.name) ? (
      <HeadingHierarchyWarnings {...props} />
    ) : (
      <BlockEdit {...props} />
    )

  return BlockEditWithHeadingWarnings
  // oxlint-disable-next-line i18next/no-literal-string
}, "withHeadingHierarchyWarnings")

export default withHeadingHierarchyWarnings
