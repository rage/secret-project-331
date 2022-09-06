import { css, cx } from "@emotion/css"
import React from "react"
import { UseFormRegisterReturn } from "react-hook-form"

interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectMenuExtraProps<T extends string> {
  id: string
  label?: string
  labelStyle?: string
  name?: string
  placeholder?: string
  error?: string
  value?: string
  defaultValue?: T
  options: SelectOption<T>[]
  onBlur?: (event: React.FocusEvent<HTMLSelectElement>) => void
  onChange?: (value: T, name?: string) => void
  className?: string
  register?: UseFormRegisterReturn
  disabled?: boolean
}

export type SelectMenuProps<T extends string> = React.HTMLAttributes<HTMLInputElement> &
  SelectMenuExtraProps<T>

const SelectField = <T extends string>({
  id,
  label,
  onChange,
  onBlur,
  defaultValue,
  options,
  className,
  register,
  disabled,
  ...rest
}: SelectMenuExtraProps<T>) => {
  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;
          ${disabled && "opacity: 0.5;"}
          select {
            appearance: none;
            background-color: transparent;
            border: none;
            margin: 0;
            width: 100%;
            font-family: inherit;
            font-size: inherit;
            cursor: ${disabled ? "default" : "pointer"};
            line-height: inherit;
            z-index: 1;
            outline: none;
          }

          select,
          .select:after {
            grid-area: select;
          }

          .select {
            width: 100%;
            border: 1px solid #e0e0e0;
            border-radius: 3px;
            padding: 8px 10px 10px 10px;
            font-size: 17px;
            cursor: ${disabled ? "default" : "pointer"};
            background: #f9f9f9;
            display: grid;
            grid-template-areas: "select";
            align-items: center;

            @media (max-width: 767.98px) {
              padding: 6px 8px;
            }
          }

          .select::after {
            content: "";
            justify-self: end;
            align-self: center;
            width: 0.8em;
            margin-right: 10px;
            height: 0.8em;
            line-height: 0;
            background-color: #333;
            clip-path: polygon(52% 80%, 0 20%, 100% 20%);
          }
          label {
            color: #333;
            font-size: 14px;
            font-weight: 500;
            ${rest.labelStyle}
          }

          .select + label {
            margin-top: 2rem;
          }
        `,
        className,
      )}
    >
      {label && <label htmlFor={id}>{label}</label>}
      <div className="select">
        <select
          disabled={Boolean(disabled)}
          id={id}
          onChange={({ target: { value } }) => onChange && onChange(value as T)}
          onBlur={onBlur}
          defaultValue={defaultValue}
          {...rest}
          // Register overrides onChange if specified
          {...register}
        >
          {options.map(({ value, label, disabled }) => (
            <option value={value} key={label} disabled={disabled} selected={disabled && true}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default SelectField
