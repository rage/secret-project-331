import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BackgroundAndColorCustomizer from "../../components/blocks/BackgroundAndColorCustomizer"
import BlockWrapper from "../BlockWrapper"

import { LandingPageHeroSectionAttributes } from "."

import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "@/shared-module/common/utils/constants"

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const LANDING_PAGE_HERO_SECTION_TEMPLATE: Template[] = [
  [
    "core/paragraph",
    { content: "Insert sales speech...", placeholder: "Insert sales speech...", align: "center" },
  ],
]

const LandingPageHeroSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<LandingPageHeroSectionAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title } = attributes
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundAndColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          noAlign
        />
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
            background-repeat: ${attributes.backgroundRepeatX ? "repeat-x" : "no-repeat"};
            background-position: center center;`}
            width: 100%;
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;

            p {
              color: ${attributes.fontColor};
            }
          `}
        >
          <RichText
            className={css`
              color: ${attributes.fontColor};
              text-align: center;
            `}
            tagName="h1"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={t("welcome-message-for-course")}
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
              {t("start")}
            </Button>
          </div>
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default LandingPageHeroSectionEditor
