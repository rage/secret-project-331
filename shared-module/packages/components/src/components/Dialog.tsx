"use client"

import { css, cx } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react"
import React from "react"
import { mergeProps, Overlay, useDialog, useModalOverlay } from "react-aria"
import { useTranslation } from "react-i18next"

import { omitUndefined } from "../lib/utils/nullability"
import { below } from "../styles/breakpoints"
import { DURATION_MS } from "../styles/motion"
import { Button, type ButtonProps } from "./Button"

export type DialogSize = "normal" | "wide"
export type DialogPadding = "normal" | "none"
export type DialogRole = "dialog" | "alertdialog"
export type DialogExit = "fade" | "handoff"

export type DialogLabelling =
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

/**
 * One footer button of a dialog.
 *
 * Accepts the `Button` props that make sense for a dialog action; `size` and layout are owned by
 * the dialog. `label` is the visible text and the accessible name.
 */
export type DialogAction = Omit<ButtonProps, "size" | "children" | "className" | "aria-label"> & {
  label: string
}

type DialogFooter =
  | {
      /** Slot for arbitrary footer content; stacks its children full width on narrow screens. */
      footer?: React.ReactNode
      actions?: undefined
    }
  | {
      footer?: undefined
      /** At least one action; rendered left to right, so put the primary action last. */
      actions: readonly [DialogAction, ...DialogAction[]]
    }

export type DialogProps = DialogLabelling &
  DialogFooter & {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    size?: DialogSize
    /**
     * Space between the surface's edge and its header, body and footer, set via
     * `--dialog-padding`. `"none"` lets children run flush to the edge (a toolbar, a table, a
     * list whose rows carry their own padding); reach for a different value through `className`.
     */
    padding?: DialogPadding
    /**
     * `"alertdialog"` wires `aria-describedby` to the content and announces it on open; use it
     * for a short interrupting message, not for a surface the user has to work through.
     */
    role?: DialogRole
    /**
     * How the surface and scrim animate on close. `"handoff"` drops the scrim immediately
     * instead of fading it, so it never doubles up with an incoming dialog's own scrim while
     * both are mid-transition. Leave it unset unless another dialog is about to replace this one.
     */
    exit?: DialogExit
    /**
     * Runs once the closed dialog has finished animating out and unmounted, so a caller that
     * keeps the element rendered for the exit can drop it at the right moment.
     */
    onExitComplete?: () => void
    /** Whether clicking the underlay closes the dialog. */
    isDismissable?: boolean
    /** Hides the visible close button in the top corner. */
    showCloseButton?: boolean
    className?: string
    /** Sets `lang` on the dialog root for correct screen reader pronunciation. */
    lang?: string | undefined
    "data-testid"?: string | undefined
  }

const CLOSE_SYMBOL = "×"

// motion/react's `ease` takes bezier control points, not the CSS strings in styles/motion.ts.
const EASE_ENTRANCE = [0.05, 0.7, 0.1, 1] as const
const EASE_EXIT = [0.3, 0, 0.8, 0.15] as const
const EASE_STANDARD = [0.2, 0, 0, 1] as const

// motion.div/AnimatePresence aren't recognized as native DOM elements by the i18next lint
// rule, so even these non-user-facing literal prop values need named constants to pass it.
const ANIMATE_PRESENCE_MODE = "sync"
const ARIA_MODAL_VALUE = "true"

const enterTransition = { duration: DURATION_MS.deliberate / 1000, ease: EASE_ENTRANCE }
// Mirrors tokens.ts's --duration-exit-deliberate: 70% of the entrance duration.
const exitTransition = { duration: (DURATION_MS.deliberate * 0.7) / 1000, ease: EASE_EXIT }
const reducedTransition = { duration: DURATION_MS.instant / 1000, ease: EASE_STANDARD }

const underlayCss = css`
  position: fixed;
  inset: 0;
  z-index: var(--layer-overlay);
  background: var(--scrim);
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

  /* The scrim is dropped in high contrast mode, so without an edge the surface merges into the page. */
  @media (forced-colors: active) {
    border: 1px solid CanvasText;
  }
`

const sizeCss: Record<DialogSize, string> = {
  normal: css`
    --dialog-width-cap: 700px;
  `,
  wide: css`
    --dialog-width-cap: 1200px;
  `,
}

const paddingCss: Record<DialogPadding, string> = {
  normal: css`
    --dialog-padding: var(--space-5);

    ${below("xs")} {
      --dialog-padding: var(--space-4);
    }
  `,
  none: css`
    --dialog-padding: 0;
  `,
}

const headerCss = css`
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--dialog-padding);
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
  padding: var(--dialog-padding);

  &[data-below-header="true"] {
    padding-top: var(--space-4);
  }
`

const footerCss = css`
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: 0 var(--dialog-padding) var(--dialog-padding);

  ${below("xs")} {
    flex-direction: column;

    & > * {
      width: 100%;
    }
  }
`

const actionCss = css`
  flex: 1 1 0;
`

/**
 * Accessible modal dialog built on react-aria `useModalOverlay` + `useDialog`.
 *
 * Focus is trapped inside while open and restored to the trigger on close, the
 * background is scroll locked and hidden from assistive technology, and Escape
 * closes. Reflows without horizontal overflow down to 320px viewports. The surface and
 * scrim animate open and closed, cross-fading instead of moving under `prefers-reduced-motion`.
 *
 * The footer is either arbitrary `footer` content or an `actions` row of buttons described as
 * data, which share the footer width evenly.
 */
export const Dialog: React.FC<DialogProps> = (props) => (
  // AnimatePresence keeps the outgoing dialog mounted through its exit animation, which is why
  // the overlay stack (focus trap, scroll lock, focus-on-mount) lives in a keyed inner component
  // rather than an early `return null`.
  <AnimatePresence
    mode={ANIMATE_PRESENCE_MODE}
    {...omitUndefined({ onExitComplete: props.onExitComplete })}
  >
    {props.open && <OpenDialog key="dialog" {...props} />}
  </AnimatePresence>
)

const OpenDialog: React.FC<DialogProps> = ({
  title,
  "aria-label": ariaLabel,
  onClose,
  children,
  size = "normal",
  padding = "normal",
  role = "dialog",
  exit = "fade",
  isDismissable = false,
  showCloseButton = true,
  footer,
  actions,
  className,
  lang,
  "data-testid": dataTestId,
}) => {
  const { t } = useTranslation("shared-module")
  const ref = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const hasTitle = title !== undefined
  const shouldReduceMotion = !!useReducedMotion()
  // Releases react-aria's focus containment for the duration of the exit animation, so a dialog
  // that replaces this one can take focus while both are briefly mounted. Restoration stays armed.
  const isExiting = !useIsPresent()

  const state = useOverlayTriggerState({
    isOpen: true,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        onClose()
      }
    },
  })
  const { modalProps, underlayProps } = useModalOverlay({ isDismissable }, state, ref)
  const { dialogProps, contentProps } = useDialog(
    hasTitle
      ? { role, "aria-labelledby": titleId }
      : omitUndefined({ role, "aria-label": ariaLabel }),
    ref,
  )

  const underlayTransition = shouldReduceMotion ? reducedTransition : exitTransition

  // react-aria types these as generic DOMAttributes, which declares style and
  // onAnimationStart/onDrag* with shapes that motion/react's motion.div rejects (it redefines
  // the handlers for its own gesture API, and disallows an explicitly optional style). None of
  // these hooks ever actually set any of the four.
  const {
    style: _underlayStyle,
    onAnimationStart: _underlayOnAnimationStart,
    onDrag: _underlayOnDrag,
    onDragStart: _underlayOnDragStart,
    onDragEnd: _underlayOnDragEnd,
    ...motionSafeUnderlayProps
  } = underlayProps
  const {
    style: _surfaceStyle,
    onAnimationStart: _surfaceOnAnimationStart,
    onDrag: _surfaceOnDrag,
    onDragStart: _surfaceOnDragStart,
    onDragEnd: _surfaceOnDragEnd,
    ...motionSafeSurfaceProps
  } = mergeProps(modalProps, dialogProps)

  return (
    <Overlay isExiting={isExiting}>
      <motion.div
        {...motionSafeUnderlayProps}
        className={underlayCss}
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{
          opacity: 1,
          transition: shouldReduceMotion ? reducedTransition : enterTransition,
        }}
        exit={{ opacity: 0, transition: exit === "handoff" ? { duration: 0 } : underlayTransition }}
      >
        <motion.div
          {...motionSafeSurfaceProps}
          // react-aria omits aria-modal because of a Safari-in-iframe focus
          // bug; we target regular browsing contexts where it improves screen
          // reader modality announcements.
          aria-modal={ARIA_MODAL_VALUE}
          ref={ref}
          lang={lang}
          data-testid={dataTestId}
          className={cx(surfaceCss, sizeCss[size], paddingCss[padding], className)}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={
            shouldReduceMotion
              ? { opacity: 1, transition: reducedTransition }
              : { opacity: 1, y: 0, scale: 1, transition: enterTransition }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0, transition: reducedTransition }
              : { opacity: 0, y: 4, scale: 0.98, transition: exitTransition }
          }
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
          <div {...contentProps} className={contentCss} data-below-header={hasTitle}>
            {children}
          </div>
          {actions !== undefined && (
            <div className={footerCss}>
              {actions.map(({ label, ...buttonProps }, index) => (
                <Button key={index} {...buttonProps} size="medium" className={actionCss}>
                  {label}
                </Button>
              ))}
            </div>
          )}
          {footer !== undefined && <div className={footerCss}>{footer}</div>}
        </motion.div>
      </motion.div>
    </Overlay>
  )
}
