import { css } from "@emotion/css"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { ColorPalette, PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
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

const ALLOWED_MIMETYPES_FOR_UPLOAD = ["image/svg+xml"]

/**
 * Props interface defining the required block attributes for background and color customization.
 */
interface RequiredAttributes {
  /** URL of the background image (SVG only) */
  backgroundImage: string | undefined
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
 * Gutenberg block editor control panel for customizing backgrounds, colors, and layout.
 *
 * Provides styling controls for:
 * - Background image upload (SVG only)
 * - Background and font color selection
 * - Content alignment options
 * - Image repeat and transparency settings
 *
 * ## Usage
 *
 * ```tsx
 * <BackgroundAndColorCustomizer
 *   attributes={attributes}
 *   setAttributes={setAttributes}
 * />
 * ```
 *
 * ```tsx
 * <BackgroundAndColorCustomizer
 *   attributes={attributes}
 *   setAttributes={setAttributes}
 *   noAlign
 * />
 * ```
 *
 * Used in `<InspectorControls>` within Gutenberg block editors.
 *
 * @param props - Component properties
 * @returns A Gutenberg PanelBody with styling controls
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
          value={attributes.fontColor ?? GRAY}
          onChange={(fontColor) => setAttributes({ fontColor })}
          clearable={false}
          colors={DEFAULT_FONT_COLORS}
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
