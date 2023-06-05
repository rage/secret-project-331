import { css, cx } from "@emotion/css"
import React, { forwardRef, InputHTMLAttributes } from "react"

interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SelectMenuProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
  labelStyle?: string
  error?: string
  options: SelectOption<string>[]
  onChangeByValue?: (value: string, name?: string) => void
}

const SelectField = forwardRef<HTMLSelectElement, SelectMenuProps>(
  (
    {
      id,
      label,
      onChangeByValue,
      onChange,
      onBlur,
      defaultValue,
      options,
      className,
      disabled,
      ...rest
    }: SelectMenuProps,
    ref,
  ) => {
    const handleOnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChangeByValue) {
        const {
          target: { value },
        } = event
        onChangeByValue(value)
      }
      if (onChange) {
        onChange(event)
      }
    }

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
              padding: 8px 10px 10px 10px;
            }

            select,
            .select:after {
              grid-area: select;
            }

            .select {
              width: 100%;
              border: 1px solid #e0e0e0;
              border-radius: 3px;
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
            onChange={handleOnChange}
            onBlur={onBlur}
            defaultValue={defaultValue}
            ref={ref}
            {...rest}
            // Register overrides onChange if specified
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
  },
)
SelectField.displayName = "SelectField"

export default SelectField
