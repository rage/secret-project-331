/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { InstructionBoxAttributes } from "."

import { primaryFont } from "@/shared-module/common/styles"

const IngressEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<InstructionBoxAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { content, title } = attributes

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
            color: #333;
            font-weight: 700;
            font-family: ${primaryFont};
          `}
          tagName="h3"
          value={title}
          onChange={(value: string) => setAttributes({ title: value })}
          placeholder={"Heading: "}
        />
        <RichText
          className="has-text-align-center wp-block-heading"
          tagName="span"
          value={content}
          onChange={(value: string) => setAttributes({ content: value })}
          placeholder={"Write a text here"}
        />
      </div>
    </BlockWrapper>
  )
}

export default IngressEditor
