"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment, useMemo } from "@wordpress/element"

import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"
import { shouldWarnAboutMissingParagraphWrapperInCustomHtml } from "./customHtmlParagraphWarning"

interface CustomHtmlBlockProps {
  name: string
  attributes: {
    content?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

const CUSTOM_HTML_BLOCK_NAME = "core/html"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withCustomHtmlParagraphWarning = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const CustomHtmlParagraphWarning = (props: CustomHtmlBlockProps) => {
    const { t } = useTranslation()
    const isPreviewMode = useIsBlockPreviewMode()

    const html = typeof props.attributes?.content === "string" ? props.attributes.content : ""
    const shouldShowWarning = useMemo(
      () => !isPreviewMode && shouldWarnAboutMissingParagraphWrapperInCustomHtml(html),
      [isPreviewMode, html],
    )

    return (
      <Fragment>
        <BlockEdit {...props} />
        {shouldShowWarning && (
          <div
            className={css`
              margin-top: 0.75rem;
            `}
          >
            <Notice status="warning" isDismissible={false}>
              {t("warning-custom-html-missing-paragraph-wrapper")}
            </Notice>
          </div>
        )}
      </Fragment>
    )
  }

  const BlockEditWithCustomHtmlParagraphWarning = (props: CustomHtmlBlockProps) =>
    props.name === CUSTOM_HTML_BLOCK_NAME ? (
      <CustomHtmlParagraphWarning {...props} />
    ) : (
      <BlockEdit {...props} />
    )

  return BlockEditWithCustomHtmlParagraphWarning
  // oxlint-disable-next-line i18next/no-literal-string
}, "withCustomHtmlParagraphWarning")

export default withCustomHtmlParagraphWarning
