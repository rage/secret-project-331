/* oxlint-disable i18next/no-literal-string */
import { emailEditorContentStyles } from "./emailEditorContentStyles"

const NO_PRESETS = { default: [], theme: [], custom: [] }

/**
 * Block editor settings that take away every control headless-lms `email_processor.rs` ignores, so
 * the email editor cannot produce styling that never reaches the inbox. `__experimentalFeatures` is
 * the theme.json-shaped settings object block supports read through `useSettings`.
 */
export const emailEditorSettings = {
  styles: emailEditorContentStyles,
  colors: [],
  gradients: [],
  fontSizes: [],
  disableCustomColors: true,
  disableCustomGradients: true,
  disableCustomFontSizes: true,
  imageEditing: false,
  imageSizes: [],
  __experimentalFeatures: {
    appearanceTools: false,
    background: { backgroundImage: false, backgroundSize: false, gradient: false },
    border: { color: false, radius: false, style: false, width: false, radiusSizes: [] },
    color: {
      background: false,
      button: false,
      caption: false,
      custom: false,
      customDuotone: false,
      customGradient: false,
      defaultDuotone: false,
      defaultGradients: false,
      defaultPalette: false,
      duotone: NO_PRESETS,
      gradients: NO_PRESETS,
      heading: false,
      link: false,
      palette: NO_PRESETS,
      text: false,
    },
    dimensions: {
      aspectRatio: false,
      aspectRatios: NO_PRESETS,
      defaultAspectRatios: false,
      height: false,
      minHeight: false,
      minWidth: false,
      width: false,
    },
    layout: { allowEditing: false },
    lightbox: { enabled: false, allowEditing: false },
    shadow: { defaultPresets: false, presets: NO_PRESETS },
    spacing: {
      blockGap: false,
      customSpacingSize: false,
      defaultSpacingSizes: false,
      margin: false,
      padding: false,
      spacingSizes: NO_PRESETS,
      units: ["px"],
    },
    typography: {
      customFontSize: false,
      defaultFontSizes: false,
      dropCap: false,
      fluid: false,
      fontFamilies: NO_PRESETS,
      fontSizes: NO_PRESETS,
      fontStyle: false,
      fontWeight: false,
      letterSpacing: false,
      lineHeight: false,
      textAlign: false,
      textColumns: false,
      textDecoration: false,
      textIndent: false,
      textTransform: false,
      writingMode: false,
    },
  },
}

/** Root layout without alignments, which hides the block alignment toolbar: emails are one column. */
export const emailEditorRootLayout = { type: "default", alignments: [] }

/** Rich text formats whose markup survives `RICH_TEXT_TAGS` in headless-lms `email_processor.rs`. */
export const emailEditorAllowedFormats = [
  "core/bold",
  "core/italic",
  "core/link",
  "core/strikethrough",
  "core/subscript",
  "core/superscript",
  "core/code",
  "core/keyboard",
  // Neither adds markup: one inserts a character, the other removes formatting.
  "core/non-breaking-space",
  "core/unknown",
]
