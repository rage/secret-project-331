"use client"

/* oxlint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { InspectorControls } from "@wordpress/block-editor"
import { PanelBody } from "@wordpress/components"
import React, { useState } from "react"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { IframeAttributes } from "."
import { IFRAME_BLOCK_DEFAULT_HEIGHT_PX } from "."
import VisibleBlockWrapper from "../../components/blocks/VisibleBlockWrapper"
import BlockWrapper from "../BlockWrapper"
import IFramePlaceHolder from "./IframePlaceholder"

const IframeEditor: React.FC<React.PropsWithChildren<BlockEditProps<IframeAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { url } = attributes
  const { t } = useTranslation()
  const [previousUrl, setPreviousUrl] = useState<string | undefined>(undefined)

  if (!url) {
    return (
      <VisibleBlockWrapper blockName="Iframe">
        <BlockWrapper id={clientId}>
          <IFramePlaceHolder
            defaultValue={previousUrl}
            setUrl={(newUrl) => {
              setAttributes({ url: newUrl })
            }}
          />
        </BlockWrapper>
      </VisibleBlockWrapper>
    )
  }

  return (
    <VisibleBlockWrapper blockName="Iframe">
      <BlockWrapper id={clientId}>
        <InspectorControls key="settings">
          <PanelBody title={"Dimensions"} initialOpen>
            <TextField
              value={attributes.heightPx?.toString() ?? IFRAME_BLOCK_DEFAULT_HEIGHT_PX}
              onChangeByValue={(newValue) => setAttributes({ heightPx: Number(newValue) })}
              label="Height px"
            />
            <TextField
              value={attributes.widthPx}
              onChangeByValue={(newValue) =>
                setAttributes({ widthPx: newValue === "" ? undefined : Number(newValue) })
              }
              placeholder="Auto"
              label="Width px (leave empty for auto)"
            />
          </PanelBody>
        </InspectorControls>
        <div
          className={css`
            background: #fafbfb;
            border: 1px solid #e2e4e6;
            padding: 1rem;
            margin-bottom: 1rem;
          `}
        >
          {attributes.url}
        </div>
        <Button
          variant={"primary"}
          size={"medium"}
          onClick={() => {
            setPreviousUrl(attributes.url)
            setAttributes({ url: undefined })
          }}
        >
          {t("edit")}
        </Button>
      </BlockWrapper>
    </VisibleBlockWrapper>
  )
}

export default IframeEditor
