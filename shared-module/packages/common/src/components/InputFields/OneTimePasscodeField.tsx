import { css } from "@emotion/css"
import React, { useCallback, useRef, useState } from "react"
import { Input, TextField } from "react-aria-components"

import { baseTheme } from "../../styles"

interface Props {
  onChange: (code: string) => void
}

export function OneTimePassCodeField({ onChange }: Props) {
  const length = 6
  const [values, setValues] = useState<string[]>(Array(length).fill(""))
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const focusInput = (index: number) => {
    inputs.current[index]?.focus()
  }

  const updateValues = useCallback(
    (newValues: string[]) => {
      setValues(newValues)
      onChange(newValues.join(""))
    },
    [onChange],
  )

  const handleChange = useCallback(
    (val: string, idx: number) => {
      if (!/^[0-9]?$/.test(val)) {
        return
      } // only allow single digit

      const newValues = [...values]
      newValues[idx] = val
      updateValues(newValues)

      if (val && idx < length - 1) {
        focusInput(idx + 1)
      }
    },
    [updateValues, values],
  )

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && !values[idx] && idx > 0) {
      focusInput(idx - 1)
    }
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent, idx: number) => {
      // eslint-disable-next-line i18next/no-literal-string
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "") // digits only
      if (!pasted) {
        return
      }

      e.preventDefault()

      const chars = pasted.slice(0, length - idx).split("")
      const newValues = [...values]

      for (let i = 0; i < chars.length; i++) {
        newValues[idx + i] = chars[i]
      }

      updateValues(newValues)

      const nextIndex = Math.min(idx + chars.length, length - 1)
      focusInput(nextIndex)
    },
    [updateValues, values],
  )

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      `}
    >
      <div
        className={css`
          display: flex;
          gap: 8px;
          justify-content: center;
        `}
      >
        {values.map((val, idx) => (
          <TextField key={idx}>
            <Input
              ref={(el) => {
                inputs.current[idx] = el
              }}
              // eslint-disable-next-line i18next/no-literal-string
              aria-label={`Digit ${idx + 1}`}
              type="text"
              // eslint-disable-next-line i18next/no-literal-string
              inputMode="numeric"
              maxLength={1}
              value={val}
              onChange={(e) => handleChange(e.target.value, idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              onPaste={(e) => handlePaste(e, idx)}
              className={css`
                width: 40px;
                height: 40px;
                font-size: 20px;
                text-align: center;
                padding: 8px;
                border-radius: 6px;
                border: 1px solid #ccc;
                &:focus {
                  outline: none;
                  border-color: ${baseTheme.colors.green[600]};
                  box-shadow: 0 0 0 1px ${baseTheme.colors.green[600]};
                }
                @media (max-width: 480px) {
                  width: 50px;
                  height: 50px;
                  font-size: 24px;
                }
              `}
            />
          </TextField>
        ))}
      </div>
    </div>
  )
}

OneTimePassCodeField.displayName = "OneTimePassCodeField"
export default OneTimePassCodeField
