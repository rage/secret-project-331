import { css, cx } from "@emotion/css"

import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const headerTopRow = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  gap: 12px;

  ${respondToOrLarger.md} {
    flex-direction: row;
    gap: 0;
  }
`

export const headerTitleWrap = css`
  flex: 1 1 auto;
  min-width: 0;
`

const headerContainerCss = css`
  width: 100%;
  max-width: 100%;
  padding: 0 16px;

  ${respondToOrLarger.md} {
    padding: 0 24px;
    max-width: 95vw;
  }

  ${respondToOrLarger.lg} {
    max-width: 90vw;
    min-width: 600px;
    padding: 0;
  }

  ${respondToOrLarger.xl} {
    min-width: 900px;
  }
`

export const headerTopSection = cx(
  headerContainerCss,
  css`
    margin: 16px auto 16px auto;

    ${respondToOrLarger.md} {
      margin: 24px auto 24px auto;
    }

    ${respondToOrLarger.lg} {
      margin: 32px auto 28px auto;
    }
  `,
)

export const headerControlsSection = cx(
  headerContainerCss,
  css`
    margin: 0 auto;
  `,
)

// Its own row above the filters: the tabs choose what is listed, the filters narrow it.
export const navigationRow = css`
  margin-bottom: 16px;
`

// Zeroes RouteTabList's own bottom margin, so navigationRow is the only source of this gap.
export const tabListCss = css`
  margin-bottom: 0;
`

// Grouped left with one gap: pushed to the corners of a 1920px page the four controls stop
// reading as one toolbar. The step down to the content below is the larger of the toolbar's two
// gaps, so the filters read as belonging to the tabs above them and controlling the content below.
export const controlsRow = css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-bottom: var(--space-5);

  ${respondToOrLarger.md} {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: end;
  }
`

export const searchBoxWrap = css`
  position: relative;
  width: 100%;

  ${respondToOrLarger.md} {
    flex: 0 1 20rem;
    width: auto;
  }
`

// Same field tokens the shared Select uses, so the two controls in one toolbar read as one system.
export const searchInput = css`
  width: 100%;
  height: var(--control-height-md);
  border: none;
  border-radius: var(--surface-radius);
  box-shadow: inset 0 0 0 1px var(--field-border);
  /* Left gutter reserves room for the icon, right for the absolute pending spinner, so long search
     text is never obscured by either. */
  padding-left: 2.75rem;
  padding-right: 2.25rem;
  font-size: 14px;
  font-family: ${primaryFont};
  color: var(--field-text-color);
  background: var(--field-bg);

  &:focus {
    outline: none;
    box-shadow:
      inset 0 0 0 1px var(--field-border-focus),
      0 0 0 var(--focus-ring-offset) var(--focus-ring-offset-color),
      0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
  }
`

export const searchIcon = css`
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  color: var(--color-gray-500);
  pointer-events: none;
`

export const searchPendingSpinner = css`
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
`
