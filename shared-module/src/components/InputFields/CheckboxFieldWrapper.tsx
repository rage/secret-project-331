import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CheckBox from "./CheckBox"

export interface CheckboxFieldWrapperProps {
  fieldName: string
  className?: string
}

const CheckboxFieldWrapper: React.FC<CheckboxFieldWrapperProps> = ({
  fieldName,
  className,
  children,
}) => {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  return (
    <div className={cx(className)}>
      <CheckBox
        label={t("set-field-value", { name: fieldName })}
        checked={checked}
        onChange={(checked: boolean) => {
          setChecked(checked)
        }}
        className={css`
          ${checked && `margin-bottom: 0.2rem;`}
        `}
      />
      {checked && children}
    </div>
  )
}

export default CheckboxFieldWrapper
