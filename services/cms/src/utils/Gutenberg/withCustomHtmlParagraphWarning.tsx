"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

import { shouldWarnAboutMissingParagraphWrapperInCustomHtml } from "./customHtmlParagraphWarning"

import { useTranslation } from "@/utils/useCmsTranslation"

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
  const CustomHtmlWithParagraphWarning = (props: CustomHtmlBlockProps) => {
    const { t } = useTranslation()

    if (props.name !== CUSTOM_HTML_BLOCK_NAME) {
      return <BlockEdit {...props} />
    }

    const html = typeof props.attributes?.content === "string" ? props.attributes.content : ""
    const shouldShowWarning = shouldWarnAboutMissingParagraphWrapperInCustomHtml(html)

    return (
      <Fragment>
        <BlockEdit {...props} />
        {shouldShowWarning && (
          <div
            className={css`
              margin-top: 0.75rem;
            `}
          >
            {}
            <Notice status="warning" isDismissible={false}>
              {t("warning-custom-html-missing-paragraph-wrapper")}
            </Notice>
          </div>
        )}
      </Fragment>
    )
  }

  CustomHtmlWithParagraphWarning.displayName = "CustomHtmlParagraphWarning"
  return CustomHtmlWithParagraphWarning
  // eslint-disable-next-line i18next/no-literal-string
}, "withCustomHtmlParagraphWarning")

export default withCustomHtmlParagraphWarning
