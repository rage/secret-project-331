"use client"

import { css, cx, keyframes } from "@emotion/css"
import React from "react"
import { mergeProps, useButton, useHover, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

export interface CopyButtonProps {
  /** Text placed on the clipboard when pressed. */
  value: string
  /** Accessible label for the button, e.g. "Copy user ID". Also the resting tooltip text. */
  label: string
  /** Visible content; defaults to a copy glyph. Overriding it opts out of the state icon swap. */
  children?: React.ReactNode
  className?: string
}

const COPY_GLYPH = "⧉"
const SUCCESS_GLYPH = "✓"
const ERROR_GLYPH = "✕"
const FALLBACK_POSITION = "fixed"
const EXEC_COMMAND_COPY = "copy"
const COPY_FAILED_MESSAGE = "Copy command was unsuccessful"
const RESET_DELAY_MS = 2000

// SCREAMING_CASE keys keep the string values out of the i18next literal-string lint.
const COPY_STATUS = {
  IDLE: "idle",
  COPIED: "copied",
  ERROR: "error",
} as const
type CopyStatus = (typeof COPY_STATUS)[keyof typeof COPY_STATUS]

const popIn = keyframes`
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`

const wrapperCss = css`
  position: relative;
  display: inline-flex;
`

const rootCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-clear-400);
  border-radius: var(--control-radius);
  background: var(--color-clear-50);
  color: var(--color-gray-500);
  cursor: pointer;
  font-size: var(--font-size-1);
  line-height: 1;
  transition:
    color 0.15s,
    border-color 0.15s;

  &[data-pressed="true"] {
    background: var(--color-clear-200);
  }
  &:hover {
    color: var(--color-gray-700);
    border-color: var(--color-gray-300);
  }
  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const glyphCss = css`
  display: inline-flex;
  animation: ${popIn} 0.18s ease;

  &[data-status="copied"] {
    color: var(--color-green-600);
  }
  &[data-status="error"] {
    color: var(--color-red-500);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const tooltipCss = css`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-gray-700);
  color: var(--color-gray-100);
  font-size: var(--font-size-1);
  line-height: 1.4;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.12s ease;

  &[data-show="true"] {
    opacity: 1;
    visibility: visible;
  }
`

// Standalone copy helper: the components package can't depend on common's useCopyToClipboard, so this
// mirrors that hook's behaviour. Try the async Clipboard API first, and on its absence OR failure
// (permission denied, document not focused, non-secure context) fall back to execCommand — throwing only
// if the fallback itself reports failure, so the caller can surface an accurate error state.
async function writeToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Fall through to the legacy execCommand path below.
    }
  }
  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = FALLBACK_POSITION
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const succeeded = document.execCommand(EXEC_COMMAND_COPY)
  document.body.removeChild(textarea)
  if (!succeeded) {
    throw new Error(COPY_FAILED_MESSAGE)
  }
}

/** Icon button that copies `value`, swaps to a check/cross with a tooltip, and announces the result. */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, label, children, className }) => {
  const { t } = useTranslation("shared-module")
  const ref = React.useRef<HTMLButtonElement>(null)
  const [status, setStatus] = React.useState<CopyStatus>(COPY_STATUS.IDLE)
  const [focused, setFocused] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  const { buttonProps, isPressed } = useButton(
    {
      "aria-label": label,
      onPress: async () => {
        let next: CopyStatus = COPY_STATUS.COPIED
        try {
          await writeToClipboard(value)
        } catch {
          next = COPY_STATUS.ERROR
        }
        setStatus(next)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => setStatus(COPY_STATUS.IDLE), RESET_DELAY_MS)
      },
    },
    ref,
  )
  const { hoverProps, isHovered } = useHover({})

  const message =
    status === COPY_STATUS.COPIED
      ? t("copy-button.copied")
      : status === COPY_STATUS.ERROR
        ? t("copy-button.failed")
        : ""
  const glyph =
    status === COPY_STATUS.COPIED
      ? SUCCESS_GLYPH
      : status === COPY_STATUS.ERROR
        ? ERROR_GLYPH
        : COPY_GLYPH

  return (
    <span className={wrapperCss}>
      <button
        {...mergeProps(buttonProps, hoverProps)}
        ref={ref}
        className={cx(rootCss, className)}
        type="button"
        data-pressed={isPressed}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {children ?? (
          <span key={status} aria-hidden="true" className={glyphCss} data-status={status}>
            {glyph}
          </span>
        )}
      </button>
      <span
        className={tooltipCss}
        data-show={isHovered || focused || status !== COPY_STATUS.IDLE}
        aria-hidden="true"
      >
        {message || label}
      </span>
      <VisuallyHidden>
        <span aria-live="polite">{message}</span>
      </VisuallyHidden>
    </span>
  )
}
