import { css } from "@emotion/css"

export const sectionsCss = css`
  display: grid;
  gap: 2rem;
`

export const sectionCss = css`
  display: grid;
  gap: 0.75rem;
`

export const headingCss = css`
  font-weight: 500;
  margin: 0;
`

export const noteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  margin: 0;
`

export const tilesCss = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
`
