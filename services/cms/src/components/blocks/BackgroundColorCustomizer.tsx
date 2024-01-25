import { css } from "@emotion/css"
import { BlockIcon } from "@wordpress/block-editor"
import { ColorPalette, PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../shared-module/common/styles"

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

const DEFAULT_BACKGROUND_COLORS = [
  { color: "#FFFFFF", name: "white" },
  { color: "#663399", name: "rebeccapurple" },
  { color: baseTheme.colors.blue[100], name: "lightblue" },
]

interface RequiredAttributes {
  backgroundColor: string | undefined
}

interface BackgroundColorCustomizerPropsWithDefaultAttributeName {
  customAttributeName?: undefined
  attributes: RequiredAttributes
  setAttributes: (attributes: Partial<RequiredAttributes>) => void
  defaultBackgroundColor: string
  customTitle?: string
}

interface BackgroundColorCustomizerPropsWithCustomAttributeName {
  customAttributeName: string
  // Not worth it to make generic over the custom attribute name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAttributes: (attributes: any) => void
  defaultBackgroundColor: string
  customTitle?: string
}

export type BackgroundColorCustomizerProps =
  | BackgroundColorCustomizerPropsWithDefaultAttributeName
  | BackgroundColorCustomizerPropsWithCustomAttributeName

const BackgroundColorCustomizer: React.FC<
  React.PropsWithChildren<BackgroundColorCustomizerProps>
> = ({ attributes, setAttributes, defaultBackgroundColor, customAttributeName, customTitle }) => {
  const { t } = useTranslation()
  // eslint-disable-next-line i18next/no-literal-string
  const attributeName = customAttributeName ? customAttributeName : "backgroundColor"
  return (
    <PanelBody title={customTitle ?? t("background")} initialOpen={false}>
      <Placeholder
        className={placeHolderFixHeightStyles}
        icon={<BlockIcon icon={icon} />}
        label={customTitle ?? t("background-color")}
      >
        <ColorPalette
          disableCustomColors={false}
          value={attributes[attributeName] ?? defaultBackgroundColor}
          onChange={(backgroundColor) => setAttributes({ [attributeName]: backgroundColor })}
          clearable={false}
          colors={DEFAULT_BACKGROUND_COLORS}
        />
      </Placeholder>
    </PanelBody>
  )
}

export default BackgroundColorCustomizer
