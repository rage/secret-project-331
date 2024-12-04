import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ResearchConsentQuestionAttributes } from "."

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"

const ResearchConsentCheckBoxEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ResearchConsentQuestionAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { content } = attributes
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("title-research-form-question")}
      explanation={t("research-form-checkbox-description")}
    >
      <div
        className={css`
          padding: 1rem 0;
          width: 100%;
          display: flex;
        `}
      >
        <b>{t("label-question")}: </b>
        <RichText
          className={css`
            width: 100%;
            margin-left: 0.25rem;
          `}
          tagName="span"
          label={t("title-research-form-question")}
          value={content}
          onChange={(value: string) => setAttributes({ content: value })}
        />
      </div>
      {(attributes.content ?? "").split(/\s+/).length < 3 && (
        <ErrorBanner error={t("error-question-too-short")} variant="readOnly" />
      )}
    </BlockPlaceholderWrapper>
  )
}

export default ResearchConsentCheckBoxEditor
