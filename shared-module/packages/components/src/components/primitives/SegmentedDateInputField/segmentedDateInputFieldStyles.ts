import { css } from "@emotion/css"

export const segmentedFieldShellCss = css`
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  color: inherit;
  outline: none;
`

/**
 * Single tight row of date/time segments (no wrap, no flex-grow between parts). The segments
 * themselves don't shrink (flex: 0 0 auto in segmentCss), so on a narrow viewport where the full
 * date+time text is wider than the field, this scrolls horizontally within its own box instead of
 * spilling past it and overlapping the parent card.
 */
export const segmentedSegmentsRowCss = css`
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 2px;
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
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

  &[data-focus-visible="true"] {
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

export const kloSegmentLiteralCss = css`
  visibility: hidden;
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
  [data-field-control][data-floated="false"] & {
    padding-top: 0;
    padding-bottom: 0;
    min-height: 0;
  }
`

/**
 * Hides placeholder segment glyphs while the floating label is at rest, keeping the row in layout
 * flow at zero height so its segments stay focusable.
 *
 * Fades rather than `visibility: hidden`: react-aria's `isFocusable` rejects hidden elements, so
 * hiding strands an empty field — `useDateField` puts `focusManager.focusFirst()` on the label's
 * click, and it would find no segment to focus. `pointer-events: none` keeps the row, now painted
 * and hit-testable, from swallowing clicks meant for the field.
 */
export const segmentedSegmentsRowRestHiddenCss = css`
  opacity: 0;
  height: 0;
  overflow: hidden;
  padding: 0;
  margin: 0;
  border: 0;
  line-height: 0;
  pointer-events: none;
`

// The shared popover shell (selectStyles.ts) also sets `min-width: var(--popover-trigger-width)`,
// sized for combobox/select popovers that should match their trigger's width. That's wrong for a
// calendar, and which `min-width` rule wins is otherwise a coin flip based on module load order
// (both classes have equal specificity). The `&&` doubles this class's specificity so our
// viewport-based floor always wins instead of the field's (possibly wider) rendered width.
export const datePickerPopoverCss = css`
  && {
    width: min(360px, calc(100vw - 32px));
    min-width: min(320px, calc(100vw - 32px));
  }
`

export const dateTimePickerPopoverCss = css`
  && {
    width: min(720px, calc(100vw - 32px));
    min-width: min(320px, calc(100vw - 32px));
  }
`
