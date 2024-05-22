/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { HighlightAttributes } from "."

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"

const HighlightEditor: React.FC<React.PropsWithChildren<BlockEditProps<HighlightAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title, content } = attributes

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
            color: ${baseTheme.colors.green[700]};
            font-weight: 700;
            font-family: ${monospaceFont};
          `}
          tagName="span"
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

export default HighlightEditor
