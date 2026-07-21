"use client"

import { css, cx } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React from "react"
import { mergeProps, Overlay, useDialog, useModalOverlay } from "react-aria"
import { useTranslation } from "react-i18next"

import { omitUndefined } from "../lib/utils/nullability"

export type DialogSize = "normal" | "wide"

type DialogLabelling =
  | {
      /** Heading rendered at the top of the dialog; also names the dialog via `aria-labelledby`. */
      title: React.ReactNode
      "aria-label"?: undefined
    }
  | {
      title?: undefined
      /** Accessible name for the dialog when no visible `title` is rendered. */
      "aria-label": string
    }

export type DialogProps = DialogLabelling & {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  size?: DialogSize
  /** Whether clicking the underlay closes the dialog. */
  isDismissable?: boolean
  /** Hides the visible close button in the top corner. */
  showCloseButton?: boolean
  /** Slot for action buttons; stacks them full width on narrow screens. */
  footer?: React.ReactNode
  className?: string
  /** Sets `lang` on the dialog root for correct screen reader pronunciation. */
  lang?: string | undefined
  "data-testid"?: string | undefined
}

const CLOSE_SYMBOL = "×"

const underlayCss = css`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
`

const surfaceCss = css`
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(95vw, var(--dialog-width-cap));
  max-height: 90vh;
  overflow: hidden;
  background: var(--color-clear-50);
  color: var(--color-gray-700);
  border-radius: 8px;
  outline: none;
`

const sizeCss: Record<DialogSize, string> = {
  normal: css`
    --dialog-width-cap: 700px;
  `,
  wide: css`
    --dialog-width-cap: 1200px;
  `,
}

const headerCss = css`
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: clamp(1rem, 5vw, 2rem);
  padding-bottom: var(--space-4);

  &[data-has-title="true"] {
    border-bottom: 1px solid var(--color-clear-300);
  }

  &[data-has-title="false"] {
    justify-content: flex-end;
    padding-bottom: 0;
  }
`

const titleCss = css`
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: var(--font-size-4);
  font-weight: 600;
  overflow-wrap: break-word;
`

const closeButtonCss = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
  margin: calc(var(--space-3) * -1) calc(var(--space-3) * -1) 0 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  font-size: var(--font-size-4);
  line-height: 1;
  color: var(--color-gray-700);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-clear-200);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const contentCss = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overflow-wrap: break-word;
  padding: clamp(1rem, 5vw, 2rem);

  &[data-below-header="true"] {
    padding-top: var(--space-4);
  }
`

const footerCss = css`
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: 0 clamp(1rem, 5vw, 2rem) clamp(1rem, 5vw, 2rem);

  @media (max-width: 480px) {
    flex-direction: column;

    & > * {
      width: 100%;
    }
  }
`

/**
 * Accessible modal dialog built on react-aria `useModalOverlay` + `useDialog`.
 *
 * Focus is trapped inside while open and restored to the trigger on close, the
 * background is scroll locked and hidden from assistive technology, and Escape
 * closes. Reflows without horizontal overflow down to 320px viewports.
 */
export const Dialog: React.FC<DialogProps> = (props) => {
  // The overlay stack (focus trap, scroll lock, focus-on-mount) must mount and
  // unmount with the open state, so the hooks live in an inner component.
  if (!props.open) {
    return null
  }
  return <OpenDialog {...props} />
}

const OpenDialog: React.FC<DialogProps> = ({
  title,
  "aria-label": ariaLabel,
  onClose,
  children,
  size = "normal",
  isDismissable = false,
  showCloseButton = true,
  footer,
  className,
  lang,
  "data-testid": dataTestId,
}) => {
  const { t } = useTranslation("shared-module")
  const ref = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const hasTitle = title !== undefined

  const state = useOverlayTriggerState({
    isOpen: true,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        onClose()
      }
    },
  })
  const { modalProps, underlayProps } = useModalOverlay({ isDismissable }, state, ref)
  const { dialogProps } = useDialog(
    hasTitle ? { "aria-labelledby": titleId } : omitUndefined({ "aria-label": ariaLabel }),
    ref,
  )

  return (
    <Overlay>
      <div {...underlayProps} className={underlayCss}>
        <div
          {...mergeProps(modalProps, dialogProps)}
          // react-aria omits aria-modal because of a Safari-in-iframe focus
          // bug; we target regular browsing contexts where it improves screen
          // reader modality announcements.
          aria-modal="true"
          ref={ref}
          lang={lang}
          data-testid={dataTestId}
          className={cx(surfaceCss, sizeCss[size], className)}
        >
          {(hasTitle || showCloseButton) && (
            <div className={headerCss} data-has-title={hasTitle}>
              {hasTitle && (
                <h2 id={titleId} className={titleCss}>
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  className={closeButtonCss}
                  aria-label={t("close")}
                  onClick={state.close}
                >
                  <span aria-hidden="true">{CLOSE_SYMBOL}</span>
                </button>
              )}
            </div>
          )}
          <div className={contentCss} data-below-header={hasTitle}>
            {children}
          </div>
          {footer !== undefined && <div className={footerCss}>{footer}</div>}
        </div>
      </div>
    </Overlay>
  )
}
