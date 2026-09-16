import { css } from "@emotion/css"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const itemsContainerCss = css`
  flex: 1;
  ${respondToOrLarger.sm} {
    flex: 0 45%;
  }
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

/** The one h1 a chatbot management page gets. */
export const pageTitleCss = css`
  margin: 0 0 1rem;
  color: var(--color-gray-700);
  font-size: var(--font-size-5);
  font-weight: 600;
  line-height: 1.2;
`

/** A section heading under the page title, such as the one above the chatbot list. */
export const sectionHeadingCss = css`
  margin: 0 0 0.5rem;
  color: var(--color-gray-700);
  font-size: var(--font-size-3-5);
  font-weight: 600;
  line-height: 1.3;
`
