"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useButton, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

export interface CopyButtonProps {
  /** Text placed on the clipboard when pressed. */
  value: string
  /** Accessible label for the button, e.g. "Copy user ID". */
  label: string
  /** Visible content; defaults to a copy glyph. */
  children?: React.ReactNode
  className?: string
}

const COPY_GLYPH = "⧉"
const FALLBACK_POSITION = "fixed"
const EXEC_COMMAND_COPY = "copy"

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

async function writeToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  // Fallback for browsers/contexts without the async clipboard API.
  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = FALLBACK_POSITION
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand(EXEC_COMMAND_COPY)
  document.body.removeChild(textarea)
}

/** A small icon button that copies `value` to the clipboard and announces success politely. */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, label, children, className }) => {
  const { t } = useTranslation("shared-module")
  const ref = React.useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  const { buttonProps } = useButton(
    {
      "aria-label": label,
      onPress: async () => {
        try {
          await writeToClipboard(value)
          setCopied(true)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          timeoutRef.current = setTimeout(() => setCopied(false), 2000)
        } catch {
          // Ignore clipboard failures — nothing actionable for the user.
        }
      },
    },
    ref,
  )

  return (
    <>
      <button {...buttonProps} ref={ref} className={cx(rootCss, className)} type="button">
        {children ?? <span aria-hidden="true">{COPY_GLYPH}</span>}
      </button>
      <VisuallyHidden>
        <span aria-live="polite">{copied ? t("copy-button.copied") : ""}</span>
      </VisuallyHidden>
    </>
  )
}
