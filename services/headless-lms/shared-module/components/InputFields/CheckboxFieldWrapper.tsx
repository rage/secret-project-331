import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CheckBox from "./CheckBox"

export interface CheckboxFieldWrapperProps {
  fieldName: string
  className?: string
  onUncheck: () => void
  initialChecked?: boolean
}

const CheckboxFieldWrapper: React.FC<CheckboxFieldWrapperProps> = ({
  fieldName,
  className,
  children,
  onUncheck,
  initialChecked,
}) => {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(initialChecked ?? false)
  return (
    <div className={cx(className)}>
      <CheckBox
        label={t("set-field-value", { name: fieldName })}
        checked={checked}
        onChange={(checked: boolean) => {
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
