"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"

import { Checkbox } from "../Checkbox"

const hiddenContentCss = css`
  display: none;
`

export type CheckboxFieldWrapperProps = React.PropsWithChildren<{
  fieldName: string
  onUncheck: () => void
  initialChecked?: boolean
}>

export function CheckboxFieldWrapper({
  fieldName,
  onUncheck,
  initialChecked = false,
  children,
}: CheckboxFieldWrapperProps) {
  const [isChecked, setIsChecked] = useState(initialChecked)
  // eslint-disable-next-line i18next/no-literal-string
  const checkboxLabel = `Set ${fieldName}`

  return (
    <div>
      <Checkbox
        label={checkboxLabel}
        checked={isChecked}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked
          setIsChecked(nextChecked)

          if (!nextChecked) {
            onUncheck()
          }
        }}
      />
      <div className={isChecked ? undefined : hiddenContentCss}>{children}</div>
    </div>
  )
}
