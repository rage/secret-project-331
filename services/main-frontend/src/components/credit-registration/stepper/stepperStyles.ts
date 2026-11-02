import { css, cx } from "@emotion/css"

const NARROW = "@media (max-width: 32rem)"

/** One page of the stepper: its parts spaced like the band they replace. */
export const pageCss = css`
  display: grid;
  gap: var(--space-4);

  > * {
    min-width: 0;
  }

  p {
    margin: 0;
  }

  h2:focus {
    outline: none;
  }
`

/** `VisuallyHidden.elementType` for a page's focus target, which has no visible title. */
export const HIDDEN_HEADING = "h2"
/** `VisuallyHidden.elementType` inside a button or a span, where its default `<div>` is invalid. */
export const HIDDEN_INLINE = "span"

export const pageHeadingCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-4);
  font-weight: 600;
  line-height: 1.3;
`

export const sectionTitleCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

export const leadCss = css`
  color: var(--color-gray-500);
`

export const captionCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/**
 * A boxed aside: a tip, the wrong-course warning, the "please register" request.
 *
 * Not a grid: that would split inline text and `Trans` slots into separate rows.
 */
export const noteBoxCss = css`
  padding: var(--space-3-5) var(--space-4);
  border: 1px solid var(--color-clear-400);
  border-radius: var(--surface-radius);

  & > :not(:first-child) {
    margin-top: var(--space-2);
  }
`

export const noteTitleCss = css`
  font-weight: 600;
`

/** Below the page's own content, separated by a rule: the way back. */
export const footerCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  align-items: center;
  margin-top: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-clear-300);
`

export const fullWidthCss = css`
  width: 100%;
`

/** Digits in circles: trims the line box to the digit so it sits in the middle. */
const digitCircleCss = css`
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--color-green-75);
  color: var(--color-green-600);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-box: trim-both cap alphabetic;
`

export const overviewNumberCss = cx(
  digitCircleCss,
  css`
    width: 44px;
    height: 44px;
    font-size: 22px;
  `,
)

/** The smaller circles look high when truly centred, so their digit is nudged down. */
export const headingNumberCss = cx(
  digitCircleCss,
  css`
    width: 32px;
    height: 32px;
    font-size: 17px;

    > span {
      display: block;
      translate: 0 0.04em;
    }
  `,
)

export const numberedHeadingCss = css`
  display: flex;
  gap: var(--space-3-5);
  align-items: center;
`

/** Content under a numbered heading, lined up with the heading's text rather than its circle. */
export const underNumberedHeadingCss = css`
  display: grid;
  gap: var(--space-3-5);
  margin-left: 44px;

  ${NARROW} {
    margin-left: 0;
  }
`

export const sectionDividerCss = css`
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-4-5);
  border-top: 1px solid var(--color-clear-300);
`

/** The highlighted outcome of the questions, with the button that follows from it. */
export const decisionCss = css`
  display: grid;
  gap: var(--space-3-5);
  padding: var(--space-4) var(--space-4-5);
  border-radius: var(--surface-radius);
  background: var(--color-green-75);
  animation: decision-enter 0.35s ease-out;

  @keyframes decision-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const decisionTextCss = css`
  font-size: var(--font-size-3);
  font-weight: 600;
`

/** A heading with a round status mark in front of it. */
export const statusHeadCss = css`
  display: flex;
  gap: var(--space-3-5);
  align-items: center;
`

const statusMarkCss = css`
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 22px;
`

export const statusMarkDoneCss = cx(
  statusMarkCss,
  css`
    background: var(--color-green-600);
    color: var(--color-clear-50);
  `,
)

export const statusMarkWaitingCss = cx(
  statusMarkCss,
  css`
    background: var(--color-green-75);
    color: var(--color-green-600);
  `,
)

export const wideActionCss = css`
  ${NARROW} {
    width: 100%;
  }
`

export const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3-5) var(--space-4);
  align-items: center;
`
