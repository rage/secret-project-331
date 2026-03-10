import { css, cx } from "@emotion/css"

import { assertNever } from "../../lib/utils/assertNever"

export type FieldSize = "sm" | "md" | "lg"

/** Per-size geometry constants for the floating-label field. */
const sizeValues = {
  sm: {
    inputPaddingTop: "1rem",
    inputPaddingBottom: "0.375rem",
    inputPaddingX: "0.75rem",
    labelRestTop: "0.9rem",
    labelLeft: "0.625rem",
    labelFloatTop: "-0.45rem",
    labelScale: 0.82,
    messageFontSize: "0.8125rem",
    borderRadius: "0.625rem",
  },
  md: {
    inputPaddingTop: "1.25rem",
    inputPaddingBottom: "0.5rem",
    inputPaddingX: "0.875rem",
    labelRestTop: "1.2rem",
    labelLeft: "0.75rem",
    labelFloatTop: "-0.5rem",
    labelScale: 0.85,
    messageFontSize: "0.875rem",
    borderRadius: "0.75rem",
  },
  lg: {
    inputPaddingTop: "1.375rem",
    inputPaddingBottom: "0.625rem",
    inputPaddingX: "1rem",
    labelRestTop: "1.25rem",
    labelLeft: "0.875rem",
    labelFloatTop: "-0.55rem",
    labelScale: 0.88,
    messageFontSize: "0.9375rem",
    borderRadius: "0.875rem",
  },
} as const

type SizeValues = (typeof sizeValues)[FieldSize]
export const fieldRootCss = css`
  width: 100%;
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
  border: 1px solid var(--field-border-color);
  outline: none;
  transition: var(--field-transition);

  /* Placeholder text is invisible; used only for :placeholder-shown detection */
  &::placeholder {
    color: transparent;
    user-select: none;
  }

  &:focus {
    border-color: var(--field-border-color-focus);
    box-shadow:
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }

  &[aria-invalid="true"] {
    border-color: var(--field-border-color-invalid);
  }

  &[aria-invalid="true"]:focus {
    border-color: var(--field-border-color-invalid);
    box-shadow:
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) rgba(130, 38, 48, 0.4);
  }

  &:disabled {
    background: var(--field-bg-disabled);
    color: var(--field-text-color-disabled);
    cursor: not-allowed;
    border-color: var(--field-border-color);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

function makeInputSizeCss(s: SizeValues): string {
  return css`
    padding: ${s.inputPaddingTop} ${s.inputPaddingX} ${s.inputPaddingBottom};
    border-radius: ${s.borderRadius};

    /* Float label when focused or when the field has a value (:placeholder-shown
       is false when the user has typed something; placeholder=" " is always set). */
    &:focus + label,
    &:not(:placeholder-shown) + label {
      top: ${s.labelFloatTop};
      left: ${s.labelLeft};
      transform: scale(${s.labelScale});
      color: var(--field-label-color-focus);
    }

    &[aria-invalid="true"]:focus + label,
    &[aria-invalid="true"]:not(:placeholder-shown) + label {
      color: var(--field-label-color-invalid);
    }

    /* When the label is floated (focused or filled), reduce top padding so the
       text content appears optically centered within the control. */
    [data-floated="true"] & {
      /* Keep total vertical padding constant while shifting content upward. */
      padding-top: calc(${s.inputPaddingTop} - 0.35rem);
      padding-bottom: calc(${s.inputPaddingBottom} + 0.35rem);
    }

    /* Icon slots: extra horizontal padding so text doesn't overlap icons. */
    [data-has-icon-start="true"] & {
      padding-left: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }
    [data-has-icon-end="true"] & {
      padding-right: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }

    /* Higher-specificity override: the label's left returns to the base edge when
       it floats, even if it was shifted right by the icon-start at rest. */
    [data-has-icon-start="true"] &:focus + label,
    [data-has-icon-start="true"] &:not(:placeholder-shown) + label {
      left: ${s.labelLeft};
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
    padding: ${s.inputPaddingTop} ${s.inputPaddingX} ${s.inputPaddingBottom};
    border-radius: ${s.borderRadius};
    resize: vertical;

    &:focus + label,
    &:not(:placeholder-shown) + label {
      top: ${s.labelFloatTop};
      left: ${s.labelLeft};
      transform: scale(${s.labelScale});
      color: var(--field-label-color-focus);
    }

    &[aria-invalid="true"]:focus + label,
    &[aria-invalid="true"]:not(:placeholder-shown) + label {
      color: var(--field-label-color-invalid);
    }

    [data-floated="true"] & {
      padding-top: calc(${s.inputPaddingTop} - 0.35rem);
      padding-bottom: calc(${s.inputPaddingBottom} + 0.35rem);
    }

    [data-has-icon-start="true"] & {
      padding-left: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }
    [data-has-icon-end="true"] & {
      padding-right: calc(${s.inputPaddingX} + var(--field-icon-slot-width));
    }

    [data-has-icon-start="true"] &:focus + label,
    [data-has-icon-start="true"] &:not(:placeholder-shown) + label {
      left: ${s.labelLeft};
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

const labelBaseCss = css`
  position: absolute;
  background: var(--field-bg);
  color: var(--field-label-color);
  padding: 0 0.25rem;
  pointer-events: none;
  transform-origin: left top;
  line-height: 1;
  max-width: calc(100% - 1rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: inherit;
  transition:
    transform 160ms ease,
    top 160ms ease,
    left 160ms ease,
    color 160ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

function makeLabelSizeCss(s: SizeValues): string {
  return css`
    top: ${s.labelRestTop};
    left: ${s.labelLeft};

    /* When icon-start is present, label rests to the right of the icon. */
    [data-has-icon-start="true"] & {
      left: calc(${s.labelLeft} + var(--field-icon-slot-width));
    }
  `
}

const labelSizeStyles: Record<FieldSize, string> = {
  sm: makeLabelSizeCss(sizeValues.sm),
  md: makeLabelSizeCss(sizeValues.md),
  lg: makeLabelSizeCss(sizeValues.lg),
}

/** Returns the composed className for the floating label element. */
export function resolveFieldLabelCss(size: FieldSize): string {
  return cx(labelBaseCss, labelSizeStyles[size])
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

/** Icon slot for multi-line textareas – anchored to the label's resting position
 *  so it appears at the top of the content area rather than the geometric centre. */
function makeTextareaIconSlotStartCss(s: SizeValues): string {
  return cx(
    iconSlotBaseCss,
    css`
      left: 0;
      top: ${s.labelRestTop};
      transform: translateY(-50%);
    `,
  )
}

export const textareaIconSlotStartStyles: Record<FieldSize, string> = {
  sm: makeTextareaIconSlotStartCss(sizeValues.sm),
  md: makeTextareaIconSlotStartCss(sizeValues.md),
  lg: makeTextareaIconSlotStartCss(sizeValues.lg),
}

/** Icon slot for multi-line textareas on the trailing edge. */
function makeTextareaIconSlotEndCss(s: SizeValues): string {
  return cx(
    iconSlotBaseCss,
    css`
      right: 0;
      top: ${s.labelRestTop};
      transform: translateY(-50%);
    `,
  )
}

export const textareaIconSlotEndStyles: Record<FieldSize, string> = {
  sm: makeTextareaIconSlotEndCss(sizeValues.sm),
  md: makeTextareaIconSlotEndCss(sizeValues.md),
  lg: makeTextareaIconSlotEndCss(sizeValues.lg),
}

const messageBaseCss = css`
  margin: 0.375rem 0 0;
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
