/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import {
  BlockIcon,
  ColorPalette,
  InnerBlocks,
  InspectorControls,
  MediaPlaceholder,
  RichText,
} from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import { PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"

import Button from "../../shared-module/components/Button"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import { baseTheme } from "../../shared-module/styles"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "../../shared-module/utils/constants"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"
import BlockWrapper from "../BlockWrapper"

import { LandingPageHeroSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const LANDING_PAGE_HERO_SECTION_TEMPLATE: Template[] = [
  [
    "core/paragraph",
    { content: "Insert sales speech...", placeholder: "Insert sales speech...", align: "center" },
  ],
]

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

const LandingPageHeroSectionEditor: React.FC<BlockEditProps<LandingPageHeroSectionAttributes>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title } = attributes
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <PanelBody title="Background" initialOpen={false}>
          {attributes.backgroundImage ? (
            <Placeholder
              className={placeHolderFixHeightStyles}
              icon={<BlockIcon icon={icon} />}
              label="Background image"
            >
              Remove
            </Placeholder>
          ) : (
            <MediaPlaceholder
              icon={<BlockIcon icon={icon} />}
              labels={{
                title: "Background image",
                instructions:
                  "Drag and drop onto this block, upload, or select existing media from your library.",
              }}
              onSelect={(media) => {
                setAttributes({ backgroundImage: media.url })
                console.log({ media })
              }}
              accept="image/svg+xml"
              allowedTypes={["image/svg+xml"]}
              onError={(error) => {
                console.error({ error })
              }}
              className={placeHolderFixHeightStyles}
            ></MediaPlaceholder>
          )}
          <Placeholder
            className={placeHolderFixHeightStyles}
            icon={<BlockIcon icon={icon} />}
            label="Background color"
          >
            <ColorPalette
              disableCustomColors={false}
              value={attributes.backgroundColor ?? "#FFFFFF"}
              onChange={(backgroundColor) => setAttributes({ backgroundColor })}
              clearable={false}
              colors={[
                { color: "#FFFFFF", name: "white" },
                { color: "#663399", name: "rebeccapurple" },
                { color: baseTheme.colors.blue[100], name: "lightblue" },
              ]}
            />
          </Placeholder>
        </PanelBody>
      </InspectorControls>
      <BreakFromCentered
        sidebar
        sidebarPosition="right"
        sidebarWidth={CMS_EDITOR_SIDEBAR_WIDTH}
        sidebarThreshold={CMS_EDITOR_SIDEBAR_THRESHOLD}
      >
        <div
          className={css`
            background-color: ${attributes.backgroundColor};
            ${attributes.backgroundImage &&
            `background-image: url("${attributes.backgroundImage}");
            background-repeat: no-repeat;
            background-position: center;`}
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;
          `}
        >
          <RichText
            className="has-text-align-center wp-block-heading"
            tagName="h1"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={"Welcome message for course..."}
          />
          <InnerBlocks
            template={LANDING_PAGE_HERO_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
          />
          <div
            className={css`
              display: flex;
              justify-content: center;
              align-items: center;
            `}
          >
            <Button variant="primary" size="large">
              Start
            </Button>
          </div>
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default LandingPageHeroSectionEditor
