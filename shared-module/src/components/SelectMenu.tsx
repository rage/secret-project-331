import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

interface SelectOption {
  value: string
  label: string
}

interface SelectMenuExtraProps {
  id: string
  label?: string
  error?: string
  value?: string
  defaultValue?: string
  options: SelectOption[]
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  className?: string
}

const DEFAULT_VALUE_KEY = "default-value"

export type SelectMenuProps = React.HTMLAttributes<HTMLInputElement> & SelectMenuExtraProps

const SelectIcon = () => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" role="presentation">
      <path
        d="M8.292 10.293a1.009 1.009 0 000 1.419l2.939 2.965c.218.215.5.322.779.322s.556-.107.769-.322l2.93-2.955a1.01 1.01 0 000-1.419.987.987 0 00-1.406 0l-2.298 2.317-2.307-2.327a.99.99 0 00-1.406 0z"
        fill="#57606f"
        fillRule="evenodd"
      ></path>
    </svg>
  )
}

const SelectMenu = ({
  id,
  label,
  onChange,
  defaultValue,
  options,
  className,
  ...rest
}: SelectMenuExtraProps) => {
  const { t } = useTranslation()
  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;

          :hover {
            background: #f9f9f9;
          }

          select {
            display: grid;
            width: 100%;
            border-radius: 4px;
            border: none;
            padding: 8px 10px;
            font-size: 18px;
            cursor: pointer;
            border: 3px solid #dfe1e6;
            background: none;
            min-height: 40px;
            grid-template-areas: "select";
            align-items: center;
            color: #4C5868;
            appearance: none;
            background: transparent;

            :hover {
              background: #f9f9f9;
            }
          }

          .select-wrapper {
            display: flex;
            width: 100%;
            align-items: center;
            margin-bottom: 0.5rem;
            position: relative;

            .select-arrow {
              position: absolute;
              top: 50%;
              transform: translateY(-50%);
              right: 10px;
              pointer-events: none;
            }
          }

          label {
            color: #333;
            font-size: 14px;
            font-weight: 500;
          }

          .select + label {
            margin-top: 2rem;
          }
        `,
        className,
      )}
    >
      {label && <label htmlFor={id}>{label}</label>}
      <div className="select-wrapper">
        <select
          id={id}
          onChange={onChange}
          defaultValue={defaultValue ?? DEFAULT_VALUE_KEY}
          {...rest}
        >
          <option value={DEFAULT_VALUE_KEY} key={DEFAULT_VALUE_KEY} disabled>
            {t("please-choose-a-value")}
          </option>
          {options.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="select-arrow">
          <SelectIcon />
        </div>
      </div>
    </div>
  )
}

export default SelectMenu
