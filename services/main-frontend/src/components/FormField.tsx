import { css } from "@emotion/css"
import React from "react"
import { FieldError, FieldPath, FieldValues, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"

interface Props<T extends FieldValues> {
  id: FieldPath<T>
  error: FieldError | undefined
  defaultValue: string | null | undefined
  placeholder: string
  register: UseFormRegister<T>
  required?: boolean
  type?: string
  value?: string
  accept?: string
}

const FormField = <T extends FieldValues>({
  id,
  defaultValue,
  error,
  register,
  required,
  placeholder,
  accept,
  ...rest
}: Props<T>): React.ReactElement => {
  const { t } = useTranslation()
  return (
    <>
      <label htmlFor={id}>{placeholder}</label>
      <br />
      {required && error && (
        <>
          <span>{t("this-field-required")}</span>
          <br />
        </>
      )}
      <input
        id={id}
        placeholder={placeholder}
        defaultValue={defaultValue || ""}
        {...register(id, { required: required })}
        {...rest}
        className={css`
          width: 100%;
          margin-bottom: 0.5rem;
        `}
        accept={accept}
      ></input>
      <br />
    </>
  )
}

export default FormField
