import { css } from "@emotion/css"

export const fieldRootCss = css`
  display: grid;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
`

export const stackedLabelCss = css`
  color: var(--field-label);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
`

export const requiredMarkCss = css`
  color: var(--field-error);
  margin-left: var(--space-1);
`

export const controlSlotCss = css`
  position: relative;
`

export const floatingControlSlotCss = css`
  position: relative;
`

export const messagesCss = css`
  display: grid;
  gap: var(--space-1);
  min-width: 0;
`

export const descriptionCss = css`
  color: var(--field-description);
  font-size: 0.875rem;
  line-height: 1.45;
  max-width: 100%;
  overflow-wrap: anywhere;
`

export const noticeCss = css`
  color: var(--field-notice);
  font-size: 0.875rem;
  line-height: 1.45;
  max-width: 100%;
  overflow-wrap: anywhere;
`

export const errorCss = css`
  color: var(--field-error);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.45;
  max-width: 100%;
  overflow-wrap: anywhere;
`
