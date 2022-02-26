/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import { baseTheme } from "../../shared-module/styles"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"
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
      <BreakFromCentered {...breakFromCenteredProps}>
        <div
          className={css`
            background: ${baseTheme.colors.green[200]};
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;
          `}
        >
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
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default HeroSectionEditor
