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

          select {
            appearance: none;
            background-color: transparent;
            border: none;
            padding: 10px 10px;
            margin: 0;
            width: 100%;
            font-family: inherit;
            font-size: inherit;
            cursor: inherit;
            line-height: inherit;
            z-index: 1;
            outline: none;
            padding-right: 40px;
          }

          select,
          .select:after {
            grid-area: select;
          }

          .select {
            width: 100%;
            border: 1px solid #e0e0e0;
            font-size: 1rem;
            cursor: pointer;
            line-height: 1.1;
            background: #f9f9f9;
            display: grid;
            grid-template-areas: "select";
            align-items: center;
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
          id={id}
          onChange={(event) => onChange(event)}
          defaultValue={DEFAULT_VALUE_KEY}
          {...rest}
        >
          <option value={DEFAULT_VALUE_KEY} key={defaultValue ?? DEFAULT_VALUE_KEY} disabled>
            {t("please-choose-a-value")}
          </option>
          {options.map((o) => (
            <option value={o.value} key={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default SelectMenu
