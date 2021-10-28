/* eslint-disable i18next/no-literal-string */
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { HeroSectionAttributes } from "."

const HeroSectionEditor: React.FC<BlockEditProps<HeroSectionAttributes>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title, subtitle } = attributes
  return (
    <BlockWrapper id={clientId}>
      <RichText
        className="has-text-align-center wp-block-heading"
        tagName="h2"
        value={title}
        onChange={(value: string) => setAttributes({ title: value })}
        placeholder={"Hero section title..."}
      />
      <RichText
        className="has-text-align-center wp-block-heading"
        tagName="h3"
        value={subtitle}
        onChange={(value: string) => setAttributes({ subtitle: value })}
        placeholder={"Hero section subtitle"}
      />
    </BlockWrapper>
  )
}

export default HeroSectionEditor
