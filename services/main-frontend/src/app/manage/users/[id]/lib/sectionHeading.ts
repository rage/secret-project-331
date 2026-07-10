import { css } from "@emotion/css"

import { primaryFont } from "@/shared-module/common/styles"

/** Shared style for the page's section headings — Inter (not the legacy Raleway), tighter scale. */
export const sectionHeadingCss = css`
  margin: 0 0 0.75rem;
  font-family: ${primaryFont};
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-gray-700, #1a2333);
`
