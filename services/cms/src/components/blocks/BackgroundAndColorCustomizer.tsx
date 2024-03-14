import { css } from "@emotion/css"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { ColorPalette, PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import { baseTheme } from "../../shared-module/styles"

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

const DEFAULT_BACKGROUND_COLORS = [
  { color: "#FFFFFF", name: "white" },
  { color: "#663399", name: "rebeccapurple" },
  { color: baseTheme.colors.blue[100], name: "lightblue" },
]

const WHITE = "#FFFFFF"

const ALLOWED_MIMETYPES_FOR_UPLOAD = ["image/svg+xml"]

interface RequiredAttributes {
  backgroundImage: string | undefined
  backgroundColor: string | undefined
  fontColor?: string | undefined
  alignCenter?: boolean | undefined
  alignBottom?: boolean | undefined
  backgroundRepeatX: boolean | undefined
  useDefaultTextForLabel?: boolean | undefined
  partiallyTransparent?: boolean | undefined
}

interface BackgroundAndColorCustomizerProps {
  attributes: RequiredAttributes
  setAttributes: (attributes: Partial<RequiredAttributes>) => void
  noAlign?: boolean
}

const BackgroundAndColorCustomizer: React.FC<
  React.PropsWithChildren<BackgroundAndColorCustomizerProps>
> = ({ attributes, setAttributes, noAlign }) => {
  const { t } = useTranslation()
  const alignCenter = attributes.alignCenter == undefined || attributes.alignCenter
  const useDefaultTextForLabel =
    attributes.useDefaultTextForLabel == undefined || attributes.useDefaultTextForLabel
  const partiallyTransparent =
    attributes.partiallyTransparent == undefined || attributes.partiallyTransparent

  return (
    <PanelBody title={t("background")} initialOpen={false}>
      {attributes.backgroundImage ? (
        <Placeholder
          className={placeHolderFixHeightStyles}
          icon={<BlockIcon icon={icon} />}
          label={t("background-image")}
        >
          <Button
            variant="tertiary"
            size="medium"
            onClick={() => {
              setAttributes({ backgroundImage: undefined })
            }}
          >
            {t("remove")}
          </Button>
        </Placeholder>
      ) : (
        <MediaPlaceholder
          icon={<BlockIcon icon={icon} />}
          labels={{
            title: t("background-image"),
            instructions: t("upload-or-drag-and-drop-onto-this-block"),
          }}
          onSelect={(media) => {
            setAttributes({ backgroundImage: media.url })
          }}
          accept={ALLOWED_MIMETYPES_FOR_UPLOAD.join(",")}
          allowedTypes={ALLOWED_MIMETYPES_FOR_UPLOAD}
          onError={(error) => {
            console.error({ error })
          }}
          className={placeHolderFixHeightStyles}
          onHTMLDrop={undefined}
        ></MediaPlaceholder>
      )}
      <Placeholder
        className={placeHolderFixHeightStyles}
        icon={<BlockIcon icon={icon} />}
        label={t("background-color")}
      >
        <ColorPalette
          disableCustomColors={false}
          value={attributes.backgroundColor ?? WHITE}
          onChange={(backgroundColor) => setAttributes({ backgroundColor })}
          clearable={false}
          colors={DEFAULT_BACKGROUND_COLORS}
        />
      </Placeholder>
      <Placeholder
        className={placeHolderFixHeightStyles}
        icon={<BlockIcon icon={icon} />}
        label={t("font-color")}
      >
        <ColorPalette
          disableCustomColors={false}
          value={attributes.fontColor ?? WHITE}
          onChange={(fontColor) => setAttributes({ fontColor })}
          clearable={false}
          colors={DEFAULT_BACKGROUND_COLORS}
        />
      </Placeholder>
      <CheckBox
        label={t("label-repeat-background-x")}
        checked={attributes.backgroundRepeatX}
        onChange={() => setAttributes({ backgroundRepeatX: !attributes.backgroundRepeatX })}
      />
      {!noAlign && (
        <>
          <CheckBox
            label={t("label-align-center")}
            checked={alignCenter}
            onChange={() => setAttributes({ alignCenter: !alignCenter })}
          />
          <CheckBox
            label={t("label-align-bottom")}
            checked={attributes.alignBottom}
            onChange={() => setAttributes({ alignBottom: !attributes.alignBottom })}
          />
        </>
      )}
      <CheckBox
        label={t("use-default-text-for-label")}
        checked={useDefaultTextForLabel}
        onChange={() => setAttributes({ useDefaultTextForLabel: !useDefaultTextForLabel })}
      />
      <CheckBox
        label={t("partially-transparent-background")}
        checked={!partiallyTransparent}
        onChange={() => setAttributes({ partiallyTransparent: !partiallyTransparent })}
      />
    </PanelBody>
  )
}

export default BackgroundAndColorCustomizer
