"use client"
import { css } from "@emotion/css"
import { BlockIcon } from "@wordpress/block-editor"
import { ColorPalette, Notice, PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

import BackgroundImageSection from "./BackgroundImageSection"

import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import { baseTheme } from "@/shared-module/common/styles"

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

const DEFAULT_BACKGROUND_COLORS = [
  { color: "#FFFFFF", name: "white" },
  { color: "#663399", name: "rebeccapurple" },
  { color: baseTheme.colors.blue[100], name: "lightblue" },
]

const DEFAULT_FONT_COLORS = [
  { color: baseTheme.colors.gray[700], name: "gray-1" },
  { color: baseTheme.colors.gray[600], name: "gray-2" },
  { color: baseTheme.colors.gray[500], name: "gray-3" },
]

const WHITE = "#FFFFFF"
const GRAY = baseTheme.colors.gray[700]

// Attribute keys
const BACKGROUND_IMAGE = "backgroundImage"
const BACKGROUND_IMAGE_MEDIUM_ATTR = "backgroundImageMedium"
const BACKGROUND_IMAGE_LARGE_ATTR = "backgroundImageLarge"
const BACKGROUND_IMAGE_XLARGE_ATTR = "backgroundImageXLarge"

/**
 * Props interface defining the required block attributes for background and color customization.
 */
interface RequiredAttributes {
  /** URL of the background image for mobile screens (default) */
  backgroundImage: string | undefined
  /** URL of the background image for medium screens (768px+) */
  backgroundImageMedium: string | undefined
  /** URL of the background image for large screens (992px+) */
  backgroundImageLarge: string | undefined
  /** URL of the background image for extra large screens (1200px+) */
  backgroundImageXLarge: string | undefined
  /** Hex color code for the background */
  backgroundColor: string | undefined
  /** Hex color code for text/font color */
  fontColor?: string | undefined
  /** Whether content should be center-aligned (default: true) */
  alignCenter?: boolean | undefined
  /** Whether background image should align to bottom instead of center */
  alignBottom?: boolean | undefined
  /** Whether background image should repeat horizontally */
  backgroundRepeatX: boolean | undefined
  /** Whether to use default text for labels */
  useDefaultTextForLabel?: boolean | undefined
  /** Whether background should have transparency applied */
  partiallyTransparent?: boolean | undefined
}

/**
 * Props for the BackgroundAndColorCustomizer component.
 */
interface BackgroundAndColorCustomizerProps {
  /** Block attributes containing styling properties */
  attributes: RequiredAttributes
  /** Function to update block attributes */
  setAttributes: (attributes: Partial<RequiredAttributes>) => void
  /** When true, hides alignment controls (alignCenter and alignBottom) */
  noAlign?: boolean
}

/**
 * Background and color customizer for Gutenberg blocks with responsive image support.
 */
const BackgroundAndColorCustomizer: React.FC<
  React.PropsWithChildren<BackgroundAndColorCustomizerProps>
> = ({ attributes, setAttributes, noAlign }) => {
  const { t } = useTranslation()
  const alignCenter = attributes.alignCenter == undefined || attributes.alignCenter
  const useDefaultTextForLabel =
    attributes.useDefaultTextForLabel == undefined || attributes.useDefaultTextForLabel
  const partiallyTransparent =
    attributes.partiallyTransparent == undefined || attributes.partiallyTransparent

  // Check if mobile background image is missing but other background images are set
  const hasOtherBackgroundImages =
    attributes.backgroundImageMedium ||
    attributes.backgroundImageLarge ||
    attributes.backgroundImageXLarge
  const isMissingMobileBackground = !attributes.backgroundImage && hasOtherBackgroundImages

  return (
    <>
      {/* Warning for missing mobile background image */}
      {isMissingMobileBackground && (
        // eslint-disable-next-line i18next/no-literal-string
        <Notice status="warning" isDismissible={false}>
          {t("warning-mobile-background-missing")}
        </Notice>
      )}

      {/* Background Images Section */}
      <PanelBody title={t("background-images")} initialOpen={false}>
        {/* Mobile Background Image (Default) */}
        <BackgroundImageSection
          imageKey={BACKGROUND_IMAGE}
          currentImage={attributes.backgroundImage}
          label={t("background-image-mobile")}
          description={t("upload-or-drag-and-drop-onto-this-block")}
          onImageSelect={(url) => setAttributes({ backgroundImage: url })}
          onImageRemove={() => setAttributes({ backgroundImage: undefined })}
        />

        {/* Medium Screen Background Image */}
        <BackgroundImageSection
          imageKey={BACKGROUND_IMAGE_MEDIUM_ATTR}
          currentImage={attributes.backgroundImageMedium}
          label={t("background-image-medium")}
          description={t("upload-or-drag-and-drop-onto-this-block")}
          onImageSelect={(url) => setAttributes({ backgroundImageMedium: url })}
          onImageRemove={() => setAttributes({ backgroundImageMedium: undefined })}
        />

        {/* Large Screen Background Image */}
        <BackgroundImageSection
          imageKey={BACKGROUND_IMAGE_LARGE_ATTR}
          currentImage={attributes.backgroundImageLarge}
          label={t("background-image-large")}
          description={t("upload-or-drag-and-drop-onto-this-block")}
          onImageSelect={(url) => setAttributes({ backgroundImageLarge: url })}
          onImageRemove={() => setAttributes({ backgroundImageLarge: undefined })}
        />

        {/* Extra Large Screen Background Image */}
        <BackgroundImageSection
          imageKey={BACKGROUND_IMAGE_XLARGE_ATTR}
          currentImage={attributes.backgroundImageXLarge}
          label={t("background-image-xlarge")}
          description={t("upload-or-drag-and-drop-onto-this-block")}
          onImageSelect={(url) => setAttributes({ backgroundImageXLarge: url })}
          onImageRemove={() => setAttributes({ backgroundImageXLarge: undefined })}
        />
      </PanelBody>

      {/* Background Layout Options */}
      <PanelBody title={t("background-layout")} initialOpen={false}>
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
          label={t("partially-transparent-background")}
          checked={!partiallyTransparent}
          onChange={() => setAttributes({ partiallyTransparent: !partiallyTransparent })}
        />
      </PanelBody>

      {/* Colors Section */}
      <PanelBody title={t("colors")} initialOpen={false}>
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
            value={attributes.fontColor ?? GRAY}
            onChange={(fontColor) => setAttributes({ fontColor })}
            clearable={false}
            colors={DEFAULT_FONT_COLORS}
          />
        </Placeholder>
      </PanelBody>

      {/* Text Options */}
      <PanelBody title={t("text-options")} initialOpen={false}>
        <CheckBox
          label={t("use-default-text-for-label")}
          checked={useDefaultTextForLabel}
          onChange={() => setAttributes({ useDefaultTextForLabel: !useDefaultTextForLabel })}
        />
      </PanelBody>
    </>
  )
}

export default BackgroundAndColorCustomizer
