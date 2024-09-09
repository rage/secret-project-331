/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { InstructionBoxAttributes } from "."

const InstructionBoxEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<InstructionBoxAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { content } = attributes

  return (
    <BlockWrapper id={clientId}>
      <div
        className={css`
          background: #fafbfb;
          border: 1px solid #e2e4e6;
          padding: 1rem;
        `}
      >
        <RichText
          className={css`
            width: 100%;
          `}
          tagName="div"
          value={content}
          onChange={(value: string) => setAttributes({ content: value })}
          placeholder={"Write a text here"}
        />
      </div>
    </BlockWrapper>
  )
}

export default InstructionBoxEditor
