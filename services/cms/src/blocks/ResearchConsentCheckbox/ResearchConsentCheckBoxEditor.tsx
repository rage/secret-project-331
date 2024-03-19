import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "../../shared-module/components/ErrorBanner"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { CheckBoxAttributes } from "."

const ResearchConsentCheckBoxEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<CheckBoxAttributes>>
> = ({ clientId, attributes, isSelected, setAttributes }) => {
  const { content } = attributes
  const { t } = useTranslation()

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("title-research-form-checkbox")}
      explanation={t("research-form-checkbox-description")}
    >
      <div
        className={css`
          display: flex;
          flex-direction: rox;
          align-items: baseline;
          padding: 1rem;
          width: 100%;
        `}
      >
        <CheckBox label={"  "} checked={isSelected} />

        <RichText
          className={css`
            width: 100%;
          `}
          tagName="span"
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
