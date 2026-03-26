import { css } from "@emotion/css"

import { fieldControlCss } from "../fieldStyles"

export const segmentedFieldShellCss = css`
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  color: inherit;
  outline: none;
`

/** Single tight row of date/time segments (no wrap, no flex-grow between parts). */
export const segmentedSegmentsRowCss = css`
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 2px;
  white-space: nowrap;
`

export const segmentedFieldDisabledCss = css`
  cursor: not-allowed;
`

export const segmentedFieldReadOnlyCss = css`
  cursor: default;
`

export const segmentedPickerGroupCss = css`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
`

export const segmentedPickerFieldCss = css`
  flex: 0 1 auto;
  min-width: 0;
`

export const segmentCss = css`
  position: relative;
  flex: 0 0 auto;
  min-width: 1ch;
  padding: 2px 0;
  border-radius: 4px;
  color: inherit;
  outline: none;
  font-variant-numeric: tabular-nums;

  &:focus-visible {
    background: var(--color-blue-50);
  }
`

export const segmentPlaceholderCss = css`
  color: var(--field-placeholder);
`

export const segmentLiteralCss = css`
  color: var(--field-chrome);
  user-select: none;
`

export const datePickerButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--field-chrome);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;

  &:focus-visible {
    outline: none;
    background: var(--color-blue-50);
    color: var(--color-blue-700);
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--color-blue-50);
    color: var(--color-blue-700);
  }
`

export const datePickerButtonIconCss = css`
  width: 18px;
  height: 18px;
`

/** Pins the calendar trigger to the trailing edge of the picker row so the segment cluster stays content-sized. */
export const segmentedPickerTriggerCss = css`
  margin-inline-start: auto;
`

/** When the label is at rest (unfloated) with no value: no vertical padding on the shell so height matches TextField. */
export const segmentedFieldShellRestEmptyCss = css`
  .${fieldControlCss}[data-floated="false"] & {
    padding-top: 0;
    padding-bottom: 0;
    min-height: 0;
  }
`

/** Hides placeholder segment glyphs while the label is at rest; keeps row in layout flow at zero height for focus. */
export const segmentedSegmentsRowRestHiddenCss = css`
  visibility: hidden;
  height: 0;
  overflow: hidden;
  padding: 0;
  margin: 0;
  border: 0;
  line-height: 0;
  pointer-events: none;
`

export const datePickerPopoverCss = css`
  width: min(360px, calc(100vw - 32px));
  min-width: min(320px, calc(100vw - 32px));
`

export const dateTimePickerPopoverCss = css`
  width: min(720px, calc(100vw - 32px));
  min-width: min(320px, calc(100vw - 32px));
`
