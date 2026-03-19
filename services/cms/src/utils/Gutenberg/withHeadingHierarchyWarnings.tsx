"use client"

import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { useSelect } from "@wordpress/data"
import { Fragment } from "@wordpress/element"
import { useTranslation } from "react-i18next"

import { getHeadingHierarchyIssuesForBlock, HeadingHierarchyIssue } from "./headingHierarchy"

interface BlockEditWithClientIdProps {
  clientId: string
  [key: string]: unknown
}

// eslint-disable-next-line i18next/no-literal-string
const W3C_HEADINGS_GUIDANCE_URL = "https://www.w3.org/WAI/test-evaluate/easy-checks/headings/"
const BLOCK_EDITOR_STORE = "core/block-editor"
const WARNING_NOTICE_STATUS = "warning"
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
  const BlockEditWithHeadingWarnings = (props: BlockEditWithClientIdProps) => {
    const { t } = useTranslation()
    const blocks = useSelect((select) => {
      return (select(BLOCK_EDITOR_STORE) as { getBlocks: () => BlockInstance[] }).getBlocks()
    }, [])

    const issues = getHeadingHierarchyIssuesForBlock(blocks, props.clientId)

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

  BlockEditWithHeadingWarnings.displayName = "HeadingHierarchyWarnings"
  return BlockEditWithHeadingWarnings
  // eslint-disable-next-line i18next/no-literal-string
}, "withHeadingHierarchyWarnings")

export default withHeadingHierarchyWarnings
