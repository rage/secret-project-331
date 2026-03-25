import { css, cx } from "@emotion/css"

import { assertNever } from "../../lib/utils/assertNever"

export type FieldSize = "sm" | "md" | "lg"

/** Shared duration/easing for label + padding + field edge motion. */
const FIELD_MOTION_DURATION = "200ms"
const FIELD_MOTION_EASING = "cubic-bezier(0.2, 0, 0, 1)"

/** Per-size geometry for filled inset floating labels (label stays inside the control).
 *  Invariant: `inputPaddingTopFloated + inputPaddingBottomFloated === 2 * inputPaddingYRest`
 *  so total vertical padding does not change when `data-floated` toggles (avoids focus layout shift). */
const sizeValues = {
  sm: {
    inputPaddingYRest: "0.875rem",
    inputPaddingTopFloated: "1.25rem",
    inputPaddingBottomFloated: "0.5rem",
    /** Segmented date/time: first value line below floated caption; slightly below ComboBox text inset. */
    segmentedInputPaddingTopFloated: "1.32rem",
    inputPaddingX: "0.75rem",
    controlHeight: "var(--control-height-sm)",
    labelLeft: "0.625rem",
    labelFloatTop: "0.45rem",
    labelRestFontSize: "1rem",
    labelFloatFontSize: "0.6875rem",
    messageFontSize: "0.8125rem",
    borderRadius: "0.375rem",
  },
  md: {
    inputPaddingYRest: "1rem",
    inputPaddingTopFloated: "1.45rem",
    inputPaddingBottomFloated: "0.55rem",
    segmentedInputPaddingTopFloated: "1.42rem",
    inputPaddingX: "0.875rem",
    controlHeight: "var(--control-height-md)",
    labelLeft: "0.75rem",
    labelFloatTop: "0.5rem",
    labelRestFontSize: "1.0625rem",
    labelFloatFontSize: "0.75rem",
    messageFontSize: "0.875rem",
    borderRadius: "0.4375rem",
  },
  lg: {
    inputPaddingYRest: "1.125rem",
    inputPaddingTopFloated: "1.55rem",
    inputPaddingBottomFloated: "0.7rem",
    segmentedInputPaddingTopFloated: "1.53rem",
    inputPaddingX: "1rem",
    controlHeight: "var(--control-height-lg)",
    labelLeft: "0.875rem",
    labelFloatTop: "0.55rem",
    labelRestFontSize: "1.125rem",
    labelFloatFontSize: "0.8125rem",
    messageFontSize: "0.9375rem",
    borderRadius: "0.5rem",
  },
} as const

type SizeValues = (typeof sizeValues)[FieldSize]
export const fieldRootCss = css`
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

export const fieldControlCss = css`
  position: relative;
  width: 100%;
`
const inputBaseCss = css`
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  line-height: 1.5;
  display: block;
  background: var(--field-bg);
  color: var(--field-text-color);
  border: 0;
  outline: none;
  box-shadow: inset 0 0 0 1px var(--field-border);
  transition:
    padding-top ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    padding-bottom ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    box-shadow ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    background-color ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING};

  &::placeholder {
    color: transparent;
    user-select: none;
  }

  &:focus {
    box-shadow:
      inset 0 0 0 1px var(--field-border-focus),
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }

  &[aria-invalid="true"] {
    box-shadow:
      inset 0 0 0 1px var(--field-border-color-invalid),
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color);
  }

  &[aria-invalid="true"]:focus {
    box-shadow:
      inset 0 0 0 1px var(--field-border-color-invalid),
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) rgba(130, 38, 48, 0.4);
  }

  &:disabled {
    background: var(--field-bg-disabled);
    color: var(--field-text-color-disabled);
    cursor: not-allowed;
    box-shadow: inset 0 0 0 1px var(--field-disabled-border);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

function makeInputSizeCss(s: SizeValues): string {
  return css`
    min-height: ${s.controlHeight};
    padding: ${s.inputPaddingYRest} ${s.inputPaddingX} ${s.inputPaddingYRest};
    border-radius: ${s.borderRadius};

    .${fieldControlCss}[data-floated="true"] & {
      padding-top: ${s.inputPaddingTopFloated};
      padding-bottom: ${s.inputPaddingBottomFloated};
    }

    .${fieldControlCss}[data-has-icon-start="true"] & {
      padding-left: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }
    .${fieldControlCss}[data-has-icon-end="true"] & {
      padding-right: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }
  `
}

const inputSizeStyles: Record<FieldSize, string> = {
  sm: makeInputSizeCss(sizeValues.sm),
  md: makeInputSizeCss(sizeValues.md),
  lg: makeInputSizeCss(sizeValues.lg),
}

/** Returns the composed className for a single-line input element. */
export function resolveInputCss(size: FieldSize): string {
  return cx(inputBaseCss, inputSizeStyles[size])
}

function makeTextareaSizeCss(s: SizeValues): string {
  return css`
    min-height: 96px;
    padding: ${s.inputPaddingYRest} ${s.inputPaddingX} ${s.inputPaddingYRest};
    border-radius: ${s.borderRadius};
    resize: vertical;

    .${fieldControlCss}[data-floated="true"] & {
      padding-top: ${s.inputPaddingTopFloated};
      padding-bottom: ${s.inputPaddingBottomFloated};
    }

    .${fieldControlCss}[data-has-icon-start="true"] & {
      padding-left: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }
    .${fieldControlCss}[data-has-icon-end="true"] & {
      padding-right: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }
  `
}

const textareaSizeStyles: Record<FieldSize, string> = {
  sm: makeTextareaSizeCss(sizeValues.sm),
  md: makeTextareaSizeCss(sizeValues.md),
  lg: makeTextareaSizeCss(sizeValues.lg),
}

/** Returns the composed className for a textarea element. */
export function resolveTextareaCss(size: FieldSize): string {
  return cx(inputBaseCss, textareaSizeStyles[size])
}

/** Muted value text when nothing is selected or the selected option has an empty value. */
export const selectTriggerValuePlaceholderCss = css`
  color: var(--field-placeholder);
`

const selectTriggerBaseCss = css`
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--field-bg);
  color: var(--field-text-color);
  border: 0;
  border-radius: var(--control-radius);
  font: inherit;
  line-height: 1.5;
  cursor: pointer;
  outline: none;
  box-shadow: inset 0 0 0 1px var(--field-border);
  transition:
    padding-top ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    padding-bottom ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    box-shadow ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING};

  .${fieldControlCss}[data-focused="true"] & {
    box-shadow:
      inset 0 0 0 1px var(--field-border-focus),
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }

  .${fieldControlCss}[data-invalid="true"] & {
    box-shadow:
      inset 0 0 0 1px var(--field-border-color-invalid),
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color);
  }

  &:disabled .${selectTriggerValuePlaceholderCss} {
    color: var(--field-disabled-fg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

function makeSelectTriggerSizeCss(s: SizeValues): string {
  return css`
    min-height: ${s.controlHeight};
    padding: 0 ${s.inputPaddingX};
    border-radius: ${s.borderRadius};

    .${fieldControlCss}[data-floated="false"] & {
      padding-top: ${s.inputPaddingYRest};
      padding-bottom: ${s.inputPaddingYRest};
      align-items: center;
    }

    .${fieldControlCss}[data-floated="true"] & {
      padding-top: ${s.inputPaddingTopFloated};
      padding-bottom: ${s.inputPaddingBottomFloated};
    }
  `
}

const selectTriggerSizeStyles: Record<FieldSize, string> = {
  sm: makeSelectTriggerSizeCss(sizeValues.sm),
  md: makeSelectTriggerSizeCss(sizeValues.md),
  lg: makeSelectTriggerSizeCss(sizeValues.lg),
}

/** Returns the composed className for a select trigger element. */
export function resolveSelectTriggerCss(size: FieldSize): string {
  return cx(selectTriggerBaseCss, selectTriggerSizeStyles[size])
}

const labelBaseCss = css`
  position: absolute;
  background: transparent;
  color: var(--field-label-color);
  padding: 0;
  pointer-events: none;
  line-height: 1.2;
  max-width: calc(100% - 1rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    transform ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    top ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    left ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    font-size ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    color ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    opacity ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

function makeLabelSizeCss(s: SizeValues): string {
  return css`
    .${fieldControlCss}[data-floated="false"] & {
      top: 50%;
      left: ${s.labelLeft};
      font-size: ${s.labelRestFontSize};
      transform: translateY(-50%) scale(1);
      transform-origin: left center;
      opacity: 0.85;
      color: var(--field-label-color);
    }

    .${fieldControlCss}[data-has-icon-start="true"][data-floated="false"] & {
      left: calc(${s.labelLeft} + var(--field-icon-slot-width));
    }

    .${fieldControlCss}[data-multiline="true"][data-floated="false"] & {
      top: ${s.inputPaddingYRest};
      transform: translateY(0) scale(1);
      transform-origin: left top;
    }

    .${fieldControlCss}[data-has-icon-start="true"][data-multiline="true"][data-floated="false"] & {
      left: calc(${s.labelLeft} + var(--field-icon-slot-width));
    }

    .${fieldControlCss}[data-floated="true"] & {
      top: ${s.labelFloatTop};
      left: ${s.labelLeft};
      font-size: ${s.labelFloatFontSize};
      transform: translateY(0) scale(1);
      transform-origin: left top;
      opacity: 1;
    }

    .${fieldControlCss}[data-has-icon-start="true"][data-floated="true"] & {
      left: calc(${s.labelLeft} + var(--field-icon-slot-width));
    }

    .${fieldControlCss}[data-floated="true"][data-focused="true"] & {
      color: var(--field-label-color-focus);
    }

    .${fieldControlCss}[data-floated="true"]:not([data-focused="true"]) & {
      color: var(--field-label-color);
    }

    .${fieldControlCss}[data-invalid="true"] & {
      color: var(--field-label-color-invalid);
    }

    .${fieldControlCss}[data-disabled="true"] & {
      color: var(--field-disabled-fg);
      opacity: 0.85;
    }
  `
}

const labelSizeStyles: Record<FieldSize, string> = {
  sm: makeLabelSizeCss(sizeValues.sm),
  md: makeLabelSizeCss(sizeValues.md),
  lg: makeLabelSizeCss(sizeValues.lg),
}

/** Returns the composed className for the inset floating label on inputs and textareas. */
export function resolveFieldLabelCss(size: FieldSize): string {
  return cx(labelBaseCss, labelSizeStyles[size])
}

const selectLabelChevronRoomCss = css`
  .${fieldControlCss}[data-floated="false"] & {
    max-width: calc(100% - 2.75rem);
  }

  .${fieldControlCss}[data-floated="true"] & {
    max-width: calc(100% - 2.5rem);
  }
`

/** Returns label className for select triggers (same inset pattern; extra room for chevron). */
export function resolveSelectLabelCss(size: FieldSize): string {
  return cx(labelBaseCss, labelSizeStyles[size], selectLabelChevronRoomCss)
}

const iconSlotBaseCss = css`
  position: absolute;
  width: var(--field-icon-slot-width);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--field-icon-color);
  pointer-events: none;
  line-height: 0;

  & > svg {
    width: 1.25em;
    height: 1.25em;
  }
`

/** Icon slot for single-line inputs – vertically centred in the fixed-height control. */
export const iconSlotStartCss = cx(
  iconSlotBaseCss,
  css`
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  `,
)

export const iconSlotEndCss = cx(
  iconSlotBaseCss,
  css`
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  `,
)

const textareaIconSlotStartCss = cx(
  iconSlotBaseCss,
  css`
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  `,
)

/** Per-size map for textarea start icons (same geometry for all sizes). */
export const textareaIconSlotStartStyles: Record<FieldSize, string> = {
  sm: textareaIconSlotStartCss,
  md: textareaIconSlotStartCss,
  lg: textareaIconSlotStartCss,
}

const textareaIconSlotEndCss = cx(
  iconSlotBaseCss,
  css`
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  `,
)

/** Per-size map for textarea end icons (same geometry for all sizes). */
export const textareaIconSlotEndStyles: Record<FieldSize, string> = {
  sm: textareaIconSlotEndCss,
  md: textareaIconSlotEndCss,
  lg: textareaIconSlotEndCss,
}

const messageBaseCss = css`
  margin: 0.375rem 0 0;
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
`

const messageDescriptionCss = css`
  color: var(--field-message-color);
`

const messageErrorCss = css`
  color: var(--field-message-color-invalid);
`

function makeMessageSizeCss(s: SizeValues): string {
  return css`
    font-size: ${s.messageFontSize};
  `
}

const messageSizeStyles: Record<FieldSize, string> = {
  sm: makeMessageSizeCss(sizeValues.sm),
  md: makeMessageSizeCss(sizeValues.md),
  lg: makeMessageSizeCss(sizeValues.lg),
}

/** Returns the composed className for a description or error message element. */
export function resolveMessageCss(size: FieldSize, isError: boolean): string {
  return cx(
    messageBaseCss,
    messageSizeStyles[size],
    isError ? messageErrorCss : messageDescriptionCss,
  )
}

/** Returns the size value object for a given FieldSize – useful for tests and
 *  components that need raw geometry values. */
export function getFieldSizeValues(size: FieldSize): SizeValues {
  switch (size) {
    case "sm":
      return sizeValues.sm
    case "md":
      return sizeValues.md
    case "lg":
      return sizeValues.lg
    default:
      return assertNever(size)
  }
}

export const controlSurfaceBaseCss = css`
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  border: 0;
  border-radius: calc(var(--control-radius) + 4px);
  background: var(--field-bg);
  color: var(--field-fg);
  box-shadow:
    inset 0 0 0 1px var(--field-border),
    var(--field-shadow);
  transition:
    box-shadow ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    padding-top ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    padding-bottom ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    background-color ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
    color ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING};

  &:focus-within {
    box-shadow:
      inset 0 0 0 1px var(--field-border-focus),
      0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14),
      var(--field-shadow);
  }

  &[data-invalid="true"] {
    box-shadow:
      inset 0 0 0 1px var(--field-error-border),
      var(--field-shadow);
  }

  &[data-invalid="true"]:focus-within {
    box-shadow:
      inset 0 0 0 1px var(--field-error-border),
      0 0 0 var(--focus-ring-width) rgba(158, 52, 31, 0.14),
      var(--field-shadow);
  }

  &[data-disabled="true"] {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    box-shadow: inset 0 0 0 1px var(--field-disabled-border);
  }

  &[data-readonly="true"] {
    background: var(--field-readonly-bg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const controlSurfaceFloatingCss = css`
  &[data-floated="true"] {
    align-items: stretch;
  }
`

export const inputResetCss = css`
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.4;
  outline: none;

  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
    border-radius: inherit;
  }

  &::placeholder {
    color: var(--field-placeholder);
  }

  &:disabled {
    cursor: not-allowed;
    -webkit-text-fill-color: currentColor;
  }
`

export const inputWithFloatingLabelCss = css`
  padding-top: 2px;
`

/** Top padding for inset floating labels; bottom padding comes from control surface (ComboBox pattern). */
function makeFloatingInsetPaddingTopCss(s: SizeValues): string {
  return css`
    transition:
      padding-top ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
      padding-bottom ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING};

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    .${fieldControlCss}[data-floated="false"] & {
      padding-top: ${s.inputPaddingYRest};
    }
    .${fieldControlCss}[data-floated="true"] & {
      padding-top: ${s.inputPaddingTopFloated};
    }
  `
}

/** Combobox input: vertical padding follows inset label band via parent data-floated. */
export function resolveComboBoxInputCss(fieldSize: FieldSize): string {
  const s = sizeValues[fieldSize]
  return cx(inputResetCss, inputWithFloatingLabelCss, makeFloatingInsetPaddingTopCss(s))
}

/** Segmented shell: rest uses symmetric vertical padding like TextField; floated top uses a dedicated
 *  inset below the caption band (tighter than ComboBox `inputPaddingTopFloated`). */
function makeSegmentedFloatingShellPaddingCss(s: SizeValues): string {
  return css`
    transition:
      padding-top ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING},
      padding-bottom ${FIELD_MOTION_DURATION} ${FIELD_MOTION_EASING};

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    .${fieldControlCss}[data-floated="false"] & {
      padding-top: ${s.inputPaddingYRest};
      padding-bottom: ${s.inputPaddingYRest};
    }

    .${fieldControlCss}[data-floated="true"] & {
      padding-top: ${s.segmentedInputPaddingTopFloated};
    }
  `
}

/** Segmented date/time field shell: rest mirrors TextField padding; floated top tracks caption geometry. */
export function resolveSegmentedFloatingShellCss(fieldSize: FieldSize): string {
  const s = sizeValues[fieldSize]
  return cx(inputWithFloatingLabelCss, makeSegmentedFloatingShellPaddingCss(s))
}

export const textareaResetCss = css`
  ${inputResetCss}
  resize: vertical;
  min-height: 96px;
  padding-bottom: 2px;
`

export const textAreaPlainControlCss = css`
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;

  &:focus-within {
    border-color: transparent;
    box-shadow:
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }
`

export const textAreaPlainTextareaCss = css`
  min-height: 0;
`

export const inlineAffixCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--field-chrome);

  & > svg {
    width: 1em;
    height: 1em;
  }
`

const controlSurfaceSizeSmCss = css`
  min-height: var(--control-height-sm);
  padding: calc(var(--control-padding-x-sm) - 2px) var(--control-padding-x-sm)
    calc(var(--control-padding-x-sm) - 2px);
  font-size: var(--font-size-sm);
`

const controlSurfaceSizeMdCss = css`
  min-height: var(--control-height-md);
  padding: calc(var(--control-padding-x-md) - 2px) var(--control-padding-x-md)
    calc(var(--control-padding-x-md) - 2px);
  font-size: var(--font-size-md);
`

const controlSurfaceSizeLgCss = css`
  min-height: var(--control-height-lg);
  padding: calc(var(--control-padding-x-lg) - 2px) var(--control-padding-x-lg)
    calc(var(--control-padding-x-lg) - 2px);
  font-size: var(--font-size-lg);
`

const controlSurfaceSizeStyles: Record<FieldSize, string> = {
  sm: controlSurfaceSizeSmCss,
  md: controlSurfaceSizeMdCss,
  lg: controlSurfaceSizeLgCss,
}

export function resolveControlSurfaceCss(fieldSize: FieldSize, isFloating = false) {
  return cx(
    controlSurfaceBaseCss,
    controlSurfaceSizeStyles[fieldSize],
    isFloating ? controlSurfaceFloatingCss : undefined,
  )
}
