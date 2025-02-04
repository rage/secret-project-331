/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { InspectorControls, RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext } from "react"

import BackgroundAndColorCustomizer from "../../components/blocks/BackgroundAndColorCustomizer"
import PageContext from "../../contexts/PageContext"
import BlockWrapper from "../BlockWrapper"

import { HeroSectionAttributes } from "."

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "@/shared-module/common/utils/constants"

const HeroSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<HeroSectionAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title, subtitle, alignCenter, useDefaultTextForLabel, label } = attributes
  const direction = alignCenter || alignCenter == undefined ? "center" : "left"
  const defaultLabel = useDefaultTextForLabel == undefined || useDefaultTextForLabel

  const path = useContext(PageContext)?.page?.url_path
  const formattedPath = path?.replace("-", " ").replace("/", "")

  const { backgroundColor, backgroundImage, backgroundRepeatX, partiallyTransparent, alignBottom } =
    attributes

  const backgroundVerticalAlignment = alignBottom ? "bottom" : "center"

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
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;
            margin-bottom: 3rem;

            background-color: ${attributes.backgroundColor};
            position: relative;

            &::after {
              background-size: 26rem;
              width: 100%;
              height: 100%;
              content: "";
              pointer-events: none;
              opacity: 0.3;
              background-image: url(${backgroundImage});
              background-repeat: ${backgroundRepeatX ? "repeat-x" : "no-repeat"};
              background-position: center ${backgroundVerticalAlignment};
              position: absolute;
              top: 0px;
              left: 0px;
              ${respondToOrLarger.md} {
                opacity: ${partiallyTransparent ? "1" : "0.4"};
                background-position: ${direction} ${backgroundVerticalAlignment};
                background-size: ${direction == "center" ? "contain" : "22rem"};
                left: ${direction == "center" ? "0" : "30px"};
              }
              ${respondToOrLarger.lg} {
                opacity: ${partiallyTransparent ? "1" : "0.4"};
                background-position: ${direction} ${backgroundVerticalAlignment};
                background-size: ${direction == "center" ? "contain" : "26rem"};
                left: ${direction == "center" ? "0" : "40px"};
              }
            }
          `}
        >
          <div
            className={css`
              color: ${attributes.fontColor};
              text-align: center;
            `}
          >
            {defaultLabel ? (
              <h6>{formattedPath}</h6>
            ) : (
              <RichText
                tagName="h6"
                value={label}
                onChange={(value: string) => setAttributes({ label: value })}
                placeholder={"Chapter number..."}
              />
            )}
          </div>
          <RichText
            className={css`
              color: ${attributes.fontColor};
              text-align: center;
            `}
            tagName="h2"
            value={title}
            onChange={(value) => {
              setAttributes({ title: value })
            }}
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
