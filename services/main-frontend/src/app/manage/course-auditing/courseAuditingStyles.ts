import { css } from "@emotion/css"
import { Filter } from "@vectopus/atlas-icons-react"

import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const ICON_SIZE_SECTION = 14
export const ICON_SIZE_SECTION_BADGE = 18

export const CourseFilterIcon = Filter

export const sectionCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
`

export const sectionHeaderRowStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`

export const sectionToggleStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.25rem 0.35rem;
  margin-left: -0.35rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: ${baseTheme.colors.gray[900]};
  border-radius: 0.35rem;

  &:hover {
    background: ${baseTheme.colors.gray[100]};
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[600]};
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
`

export const sectionChevronStyles = (expanded: boolean) => css`
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
  color: ${baseTheme.colors.gray[500]};
  transform: rotate(${expanded ? "180deg" : "0deg"});
  transition: transform 0.15s ease;
`

export const sectionBodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

export const sectionTitleStyles = css`
  font-size: 1.15rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

export const sectionHeaderIconWrapStyles = css`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.375rem;
  background: ${baseTheme.colors.green[50]};
  color: ${baseTheme.colors.green[700]};
`

export const subsectionTitleStyles = css`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.25rem 0 0 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid ${baseTheme.colors.gray[200]};
`

export const uhCalloutStyles = css`
  margin-top: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.blue[200]};
  background: ${baseTheme.colors.blue[25]};
  padding: 0.85rem 1rem;
`

export const uhCalloutTitleStyles = css`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.5rem 0;
`

export const uhLineStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.35rem 0;
  line-height: 1.5;
`

export const uhLinkStyles = css`
  color: ${baseTheme.colors.green[700]};
  text-decoration: underline;
  word-break: break-all;
`
