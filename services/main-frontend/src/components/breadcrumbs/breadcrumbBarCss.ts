import { css } from "@emotion/css"

/**
 * The full-bleed breadcrumb row's own gutter and rhythm.
 *
 * Every breadcrumb trail sits inside `BreakFromCentered`, which spans the viewport and leaves the
 * crumbs to space themselves; without this they start at the window edge.
 */
export const breadcrumbBarCss = css`
  padding: 1rem 2rem;

  &:nth-of-type(n + 2) {
    margin-top: 2.5rem;
  }
`
