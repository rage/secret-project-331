import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import BlockWrapper from "../BlockWrapper"

import { TerminologyBlockAttributes } from "."

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "@/shared-module/common/utils/constants"

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph"]
const LANDING_PAGE_HERO_SECTION_TEMPLATE: Template[] = [
  ["core/paragraph", { content: "Insert sales speech...", placeholder: "Insert sales speech..." }],
]

const TerminologyBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<TerminologyBlockAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title } = attributes
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          // eslint-disable-next-line i18next/no-literal-string
          defaultBackgroundColor="#007acc"
          // eslint-disable-next-line i18next/no-literal-string
          customAttributeName="primaryColor"
          customTitle={t("separator-color")}
        />
      </InspectorControls>
      <div>
        <div
          className={css`
            border-radius: 1px;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 7.5em 1em;

            p {
              color: #333;
            }
          `}
        >
          <RichText
            className={css`
              color: #333;
              text-align: center;
            `}
            // eslint-disable-next-line i18next/no-literal-string
            tagName="h1"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={t("welcome-message-for-course")}
          />
          <InnerBlocks
            template={LANDING_PAGE_HERO_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
          />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default TerminologyBlockEditor
