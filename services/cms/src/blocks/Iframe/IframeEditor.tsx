"use client"

/* oxlint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { InspectorControls } from "@wordpress/block-editor"
import { PanelBody } from "@wordpress/components"
import React, { useState } from "react"

import { Button, TextField } from "@/shared-module/components"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { IframeAttributes } from "."
import { IFRAME_BLOCK_DEFAULT_HEIGHT_PX } from "."
import VisibleBlockWrapper from "../../components/blocks/VisibleBlockWrapper"
import BlockWrapper from "../BlockWrapper"
import IFramePlaceHolder from "./IframePlaceholder"

interface DimensionValues {
  heightPx: string
  widthPx: string
}

interface DimensionFieldsProps {
  attributes: IframeAttributes
  setAttributes: (attributes: Partial<IframeAttributes>) => void
}

const DimensionFields: React.FC<DimensionFieldsProps> = ({ attributes, setAttributes }) => {
  const { control } = useAttributeForm<DimensionValues>(
    {
      heightPx: (attributes.heightPx ?? IFRAME_BLOCK_DEFAULT_HEIGHT_PX).toString(),
      widthPx: attributes.widthPx?.toString() ?? "",
    },
    ({ heightPx, widthPx }) =>
      setAttributes({
        heightPx: Number(heightPx),
        widthPx: widthPx === "" ? undefined : Number(widthPx),
      }),
  )
  return (
    <>
      <TextField name="heightPx" control={control} label="Height px" />
      <TextField name="widthPx" control={control} label="Width px (leave empty for auto)" />
    </>
  )
}

const IframeEditor: React.FC<React.PropsWithChildren<BlockEditProps<IframeAttributes>>> = ({
  attributes,
  setAttributes,
}) => {
  const { url } = attributes
  const { t } = useTranslation()
  const [previousUrl, setPreviousUrl] = useState<string | undefined>(undefined)

  if (!url) {
    return (
      <BlockWrapper>
        <VisibleBlockWrapper blockName="Iframe">
          <IFramePlaceHolder
            defaultValue={previousUrl}
            setUrl={(newUrl) => {
              setAttributes({ url: newUrl })
            }}
          />
        </VisibleBlockWrapper>
      </BlockWrapper>
    )
  }

  return (
    <BlockWrapper>
      <VisibleBlockWrapper blockName="Iframe">
        <InspectorControls key="settings">
          <PanelBody title={"Dimensions"} initialOpen>
            <DimensionFields attributes={attributes} setAttributes={setAttributes} />
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
      </VisibleBlockWrapper>
    </BlockWrapper>
  )
}

export default IframeEditor
