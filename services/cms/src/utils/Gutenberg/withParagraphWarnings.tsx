"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"
import { useTranslation } from "react-i18next"

import { shouldWarnAboutParagraphLookingLikeHeading } from "./paragraphHeadingWarning"

interface ParagraphBlockProps {
  name: string
  attributes: {
    content?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

const PARAGRAPH_BLOCK_NAME = "core/paragraph"
type ParagraphWarningKey = "warning-paragraph-bold-line-looks-like-heading"
const PARAGRAPH_HEADING_WARNING_KEY: ParagraphWarningKey =
  "warning-paragraph-bold-line-looks-like-heading"
const WARNING_NOTICE_STATUS = "warning"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withParagraphWarnings = createHigherOrderComponent((BlockEdit) => {
  const ParagraphWithWarnings = (props: ParagraphBlockProps) => {
    const { t } = useTranslation()

    if (props.name !== PARAGRAPH_BLOCK_NAME) {
      return <BlockEdit {...props} />
    }

    const html = typeof props.attributes?.content === "string" ? props.attributes.content : ""
    const warningKeys: ParagraphWarningKey[] = shouldWarnAboutParagraphLookingLikeHeading(html)
      ? [PARAGRAPH_HEADING_WARNING_KEY]
      : []

    return (
      <Fragment>
        <BlockEdit {...props} />
        {warningKeys.length > 0 && (
          <div
            className={css`
              margin-top: 0.75rem;
            `}
          >
            {warningKeys.map((warningKey) => (
              <Notice key={warningKey} status={WARNING_NOTICE_STATUS} isDismissible={false}>
                {t(warningKey)}
              </Notice>
            ))}
          </div>
        )}
      </Fragment>
    )
  }

  ParagraphWithWarnings.displayName = "ParagraphWarnings"
  return ParagraphWithWarnings
  // eslint-disable-next-line i18next/no-literal-string
}, "withParagraphWarnings")

export default withParagraphWarnings
