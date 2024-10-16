/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { InstructionBoxAttributes } from "."

import { headingFont, primaryFont } from "@/shared-module/common/styles"

const IngressEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<InstructionBoxAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title, subtitle } = attributes

  return (
    <BlockWrapper id={clientId}>
      <div
        className={css`
          background: #fafbfb;
          padding: 2rem;
        `}
      >
        <RichText
          className={css`
            color: #1a2333;
            font-weight: 700;
            font-size: 3.5rem;
            line-height: 4.375rem;
            margin-bottom: 1rem;
            letter-spacing: -1;
            font-family: ${headingFont};
          `}
          tagName="h2"
          value={title}
          onChange={(value: string) => setAttributes({ title: value })}
          placeholder={"Heading: "}
        />
        <RichText
          className={css`
            color: #1a2333;
            font-weight: normal;
            font-size: 1.75rem;
            line-height: 1.35;
            margin-bottom: 2rem;
            opacity: 0.9;
            font-family: ${primaryFont};
          `}
          tagName="h3"
          value={subtitle}
          onChange={(value: string) => setAttributes({ subtitle: value })}
          placeholder={"Write a text here"}
        />
      </div>
    </BlockWrapper>
  )
}

export default IngressEditor
