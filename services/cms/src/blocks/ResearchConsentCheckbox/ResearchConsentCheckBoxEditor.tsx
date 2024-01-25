/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import CheckBox from "../../shared-module/common/components/InputFields/CheckBox"
import BlockWrapper from "../BlockWrapper"

import { CheckBoxAttributes } from "."

const ResearchConsentCheckBoxEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<CheckBoxAttributes>>
> = ({ clientId, attributes, isSelected, setAttributes }) => {
  const { content } = attributes

  return (
    <BlockWrapper id={clientId}>
      <div
        className={css`
          display: flex;
          flex-direction: rox;
          align-items: baseline;
          padding: 1rem;
        `}
      >
        <CheckBox label={"  "} checked={isSelected} />

        <RichText
          className="paragraph"
          tagName="span"
          value={content}
          onChange={(value: string) => setAttributes({ content: value })}
          placeholder={"Add question here"}
        />
      </div>
    </BlockWrapper>
  )
}

export default ResearchConsentCheckBoxEditor
