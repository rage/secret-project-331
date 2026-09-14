import { css } from "@emotion/css"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"

/** Shared style for the page's section headings, on a tighter scale than the global heading sizes. */
export const sectionHeadingCss = css`
  margin: 0 0 0.75rem;
  font-family: ${primaryFont};
  font-size: 1.3rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
`
