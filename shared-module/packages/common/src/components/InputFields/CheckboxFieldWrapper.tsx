import { css, cx } from "@emotion/css"
import React, { InputHTMLAttributes, useState } from "react"
import { useTranslation } from "react-i18next"

import CheckBox from "./CheckBox"

export interface CheckboxFieldWrapperProps extends InputHTMLAttributes<HTMLInputElement> {
  fieldName: string
  onUncheck: () => void
  initialChecked?: boolean
}

const CheckboxFieldWrapper: React.FC<
  React.PropsWithChildren<CheckboxFieldWrapperProps>
> = ({ fieldName, className, children, onUncheck, initialChecked }) => {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(initialChecked ?? false)
  return (
    <div className={cx(className)}>
      <CheckBox
        label={t("set-field-value", { name: fieldName })}
        checked={checked}
        onChangeByValue={(checked: boolean) => {
          if (!checked) {
            onUncheck()
          }
          setChecked(checked)
        }}
        className={css`
          ${checked && `margin-bottom: 0.2rem;`}
        `}
      />
      <div
        className={css`
          ${!checked && `display: none;`}
        `}
      >
        {children}
      </div>
    </div>
  )
}

export default CheckboxFieldWrapper
