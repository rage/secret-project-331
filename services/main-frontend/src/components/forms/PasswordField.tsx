"use client"

import { css } from "@emotion/css"
import { Eye } from "@vectopus/atlas-icons-react"
import { useState } from "react"
import type { FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { TextField } from "@/shared-module/components"
import type { TextFieldProps } from "@/shared-module/components"

// PasswordField wraps the shared TextField with an accessible show/hide toggle.
// The toggle is an overlay button aligned to the field's (non-interactive) icon slot.
export type PasswordFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = Omit<
  TextFieldProps<T, N>,
  "type" | "iconEnd"
>

const eyeWrapCss = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  /* A full-strength colour so the toggle reads as interactive (the default icon colour is too muted). */
  color: var(--field-fg, currentColor);
`

// Diagonal strike drawn over the eye when the password is hidden. State is conveyed by this shape
// change (not colour alone) so it stays distinguishable regardless of contrast or colour perception.
const strikeCss = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
`

const toggleCss = css`
  position: absolute;
  top: 0;
  right: 0;
  width: var(--field-icon-slot-width, 2.5rem);
  height: var(--control-height-md, 2.75rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--control-radius, 4px);

  &:focus-visible {
    outline: var(--focus-ring-width, 2px) solid var(--focus-ring-color, currentColor);
    outline-offset: -2px;
  }
`

export function PasswordField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: PasswordFieldProps<T, N>,
) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  return (
    <div
      className={css`
        position: relative;
      `}
    >
      <TextField
        {...props}
        type={visible ? "text" : "password"}
        iconEnd={
          <span className={eyeWrapCss}>
            <Eye size={20} />
            {!visible && (
              <svg
                className={strikeCss}
                viewBox="0 0 20 20"
                width={20}
                height={20}
                aria-hidden="true"
              >
                {/* Under-stroke in the field background colour creates a cut-out so the line
                    stays legible where it crosses the eye. */}
                <line
                  x1="3.5"
                  y1="16.5"
                  x2="16.5"
                  y2="3.5"
                  stroke="var(--field-bg, #ffffff)"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                <line
                  x1="3.5"
                  y1="16.5"
                  x2="16.5"
                  y2="3.5"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
        }
      />
      <button
        type="button"
        className={toggleCss}
        aria-pressed={visible}
        aria-label={visible ? t("hide-password") : t("show-password")}
        onClick={() => setVisible((v) => !v)}
      />
    </div>
  )
}

export default PasswordField
