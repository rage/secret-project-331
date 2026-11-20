"use client"

import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import React from "react"

import { ErrorNotice } from "@/shared-module/components"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ResearchConsentQuestionAttributes } from "."
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"
import { isResearchQuestionTooShort } from "./questionLength"

const ResearchConsentCheckBoxEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ResearchConsentQuestionAttributes>>
> = ({ attributes, setAttributes }) => {
  const { content } = attributes
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
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
          // RichText spreads unknown props onto the editable element, so `label` would land as a
          // bare attribute and leave the field without an accessible name.
          aria-label={t("title-research-form-question")}
          placeholder={t("research-form-question-placeholder")}
          value={content}
          onChange={(value: string) => setAttributes({ content: value })}
        />
      </div>
      {(content ?? "").trim() !== "" && isResearchQuestionTooShort(content) && (
        <ErrorNotice error={t("error-question-too-short")} />
      )}
    </BlockPlaceholderWrapper>
  )
}

export default ResearchConsentCheckBoxEditor
