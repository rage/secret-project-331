import { css } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const ICON_SIZE_BUTTON = 14

export const designListStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`

export const designListRowStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.5rem;
`

export const guidanceCardStyles = css`
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.clear[50]};
  padding: 0.85rem 1rem;
`

export const tipStyles = css`
  border-left: 3px solid ${baseTheme.colors.green[500]};
  padding: 0.35rem 0 0.35rem 0.75rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.55;
  margin: 0;
`

export const threeColGridStyles = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr);

  ${respondToOrLarger.lg} {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`

export const checkboxGridStyles = css`
  display: grid;
  gap: 0.5rem 1rem;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
`

export const fieldsetStyles = css`
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`

export const legendStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.4rem 0;
  padding: 0;
`
