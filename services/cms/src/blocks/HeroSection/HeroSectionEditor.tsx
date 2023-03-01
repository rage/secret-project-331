/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { InspectorControls, RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BackgroundAndColorCustomizer from "../../components/blocks/BackgroundAndColorCustomizer"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import { baseTheme } from "../../shared-module/styles"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "../../shared-module/utils/constants"
import BlockWrapper from "../BlockWrapper"

import { HeroSectionAttributes } from "."

const HeroSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<HeroSectionAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title, subtitle, alignCenter, chapter } = attributes
  const direction = alignCenter ? "center" : "left"
  console.log({ attributes })
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundAndColorCustomizer attributes={attributes} setAttributes={setAttributes} />
      </InspectorControls>
      <BreakFromCentered
        sidebar
        sidebarPosition="right"
        sidebarWidth={CMS_EDITOR_SIDEBAR_WIDTH}
        sidebarThreshold={CMS_EDITOR_SIDEBAR_THRESHOLD}
      >
        <div
          className={css`
            background: ${baseTheme.colors.green[200]};
            background-color: ${attributes.backgroundColor};
            ${attributes.backgroundImage &&
            `background-image: url("${attributes.backgroundImage}");
            background-repeat: no-repeat;
            background-position: ${direction} center;`}
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;
          `}
        >
          <RichText
            className={css`
              color: ${attributes.fontColor};
              text-align: center;
            `}
            tagName="h6"
            value={chapter}
            onChange={(value: string) => setAttributes({ chapter: value })}
            placeholder={"Chapter number..."}
          />
          <RichText
            className={css`
              color: ${attributes.fontColor};
              text-align: center;
            `}
            tagName="h2"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={"Hero section title..."}
          />
          <RichText
            className={css`
              color: ${attributes.fontColor};
              text-align: center;
            `}
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
