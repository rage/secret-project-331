import { css } from "@emotion/css"

export const nativeSelectCss = css`
  appearance: none;
  cursor: pointer;
  padding-right: 28px;

  &:disabled {
    cursor: not-allowed;
  }
`

export const selectCaretCss = css`
  position: absolute;
  right: 14px;
  top: 50%;
  width: 10px;
  height: 10px;
  border-right: 1.8px solid var(--field-chrome);
  border-bottom: 1.8px solid var(--field-chrome);
  pointer-events: none;
  transform: translateY(-65%) rotate(45deg);
`

export const popoverCss = css`
  position: absolute;
  z-index: 20;
  min-width: var(--popover-trigger-width, 0);
  max-width: min(100vw - 24px, 560px);
  box-sizing: border-box;
  border: 1px solid var(--field-border);
  border-radius: calc(var(--control-radius) + 4px);
  background: var(--field-bg);
  box-shadow: 0 14px 32px rgba(10, 15, 23, 0.18);
`

export const listBoxCss = css`
  margin: 0;
  padding: var(--space-2);
  list-style: none;
  max-height: 240px;
  overflow: auto;
`

export const listBoxOptionCss = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 40px;
  padding: 0 var(--space-3);
  border-radius: calc(var(--control-radius) + 1px);
  color: var(--field-fg);
  cursor: pointer;
  line-height: 1.35;

  & > span:first-of-type {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &[data-selected="true"] {
    background: var(--field-option-selected);
  }

  &[data-highlighted="true"]:not([data-selected="true"]) {
    background: var(--field-option-highlight);
  }

  &[data-selected="true"][data-highlighted="true"] {
    background: var(--field-option-selected);
  }

  &[data-focus-visible="true"] {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -2px;
  }

  &[data-disabled="true"] {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }
`

export const listBoxEmptyStateCss = css`
  padding: var(--space-3);
  color: var(--field-description);
  font-size: 0.9375rem;
`

export const comboTriggerButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--field-chrome);
  cursor: pointer;
`

export const comboChevronCss = css`
  width: 10px;
  height: 10px;
  border-right: 1.8px solid currentColor;
  border-bottom: 1.8px solid currentColor;
  transform: rotate(45deg);
`

export const comboSelectedMarkCss = css`
  width: 10px;
  height: 6px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg) translateY(-1px);
`

export const fileTriggerRowCss = css`
  display: grid;
  gap: var(--space-2);
`

export const fileButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: var(--control-height-md);
  padding: 0 var(--control-padding-x-md);
  border: 1px solid var(--field-border);
  border-radius: calc(var(--control-radius) + 4px);
  background: var(--color-clear-50);
  color: var(--field-fg);
  cursor: pointer;
  font-size: var(--font-size-md);
  font-weight: 500;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.18);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    border-color: var(--field-disabled-border);
    cursor: not-allowed;
  }
`
