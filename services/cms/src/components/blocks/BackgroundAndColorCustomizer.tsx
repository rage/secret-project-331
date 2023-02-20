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
  backgroundRepeatX: boolean | undefined
}

interface BackgroundAndColorCustomizerProps {
  attributes: RequiredAttributes
  setAttributes: (attributes: Partial<RequiredAttributes>) => void
}

const BackgroundAndColorCustomizer: React.FC<
  React.PropsWithChildren<BackgroundAndColorCustomizerProps>
> = ({ attributes, setAttributes }) => {
  const { t } = useTranslation()
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
            console.log({ media })
          }}
          accept={ALLOWED_MIMETYPES_FOR_UPLOAD.join(",")}
          allowedTypes={ALLOWED_MIMETYPES_FOR_UPLOAD}
          onError={(error) => {
            console.error({ error })
          }}
          className={placeHolderFixHeightStyles}
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
      <CheckBox
        label={t("label-repeat-background-x")}
        checked={attributes.backgroundRepeatX}
        onChange={() => setAttributes({ backgroundRepeatX: !attributes.backgroundRepeatX })}
      />
    </PanelBody>
  )
}

export default BackgroundAndColorCustomizer
