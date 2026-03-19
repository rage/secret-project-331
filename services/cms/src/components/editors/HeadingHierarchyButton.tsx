"use client"

import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  analyzeHeadingHierarchy,
  HeadingHierarchyEntry,
  HeadingHierarchyIssue,
} from "../../utils/Gutenberg/headingHierarchy"

import Button from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"

interface HeadingHierarchyButtonProps {
  content: BlockInstance[]
}

const renderIssueText = (
  issue: HeadingHierarchyIssue,
  t: ReturnType<typeof useTranslation>["t"],
): string => {
  switch (issue.type) {
    case "heading-h1-reserved":
      return t("warning-heading-h1-reserved")
    case "heading-first-should-be-h2":
      return t("warning-heading-first-should-be-h2")
    case "heading-level-jump":
      return t("warning-heading-level-jump", {
        fromLevel: issue.previousLevel,
        toLevel: issue.level,
      })
  }
}

const HeadingHierarchyDialogContent: React.FC<{ entries: HeadingHierarchyEntry[] }> = ({
  entries,
}) => {
  const { t } = useTranslation()

  if (entries.length === 0) {
    return <p>{t("heading-hierarchy-empty")}</p>
  }

  return (
    <div
      className={css`
        max-height: min(70vh, 40rem);
        overflow-y: auto;
      `}
    >
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={css`
            margin-bottom: 0.85rem;
          `}
        >
          <div
            className={css`
              margin-left: ${(entry.level - 1) * 0.9}rem;
              font-weight: 600;
              overflow-wrap: anywhere;
            `}
          >
            {`H${entry.level} ${entry.text}`}
          </div>
          {entry.issues.map((issue, index) => (
            <div
              key={`${issue.type}-${issue.previousLevel ?? "none"}-${index}`}
              className={css`
                margin-top: 0.35rem;
                margin-left: ${(entry.level - 1) * 0.9}rem;
                color: #8a4b00;
                font-size: 0.95rem;
                overflow-wrap: anywhere;
              `}
            >
              {renderIssueText(issue, t)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const HeadingHierarchyButton: React.FC<HeadingHierarchyButtonProps> = ({ content }) => {
  const { t } = useTranslation()
  const { alert } = useDialog()
  const entries = useMemo(() => analyzeHeadingHierarchy(content), [content])

  return (
    <Button
      variant="secondary"
      size="medium"
      className={css`
        width: 100%;
        margin-bottom: 1rem;
      `}
      onClick={() => {
        void alert(
          <HeadingHierarchyDialogContent entries={entries} />,
          t("dialog-title-heading-hierarchy"),
        )
      }}
    >
      {t("button-heading-hierarchy")}
    </Button>
  )
}

export default HeadingHierarchyButton
