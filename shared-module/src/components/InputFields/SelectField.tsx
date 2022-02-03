import styled from "@emotion/styled"
import React from "react"

interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectMenuExtraProps<T extends string> {
  id: string
  label?: string
  error?: string
  value?: string
  defaultValue?: T
  options: SelectOption<T>[]
  onBlur: (event: React.FocusEvent<HTMLSelectElement>) => void
  onChange: (value: T, name?: string) => void
}

const Wrapper = styled.div`
  select {
    appearance: none;
    background-color: transparent;
    border: none;
    padding: 8px 10px;
    margin: 0;
    width: 100%;
    font-family: inherit;
    font-size: inherit;
    cursor: inherit;
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
`

export type SelectMenuProps<T extends string> = React.HTMLAttributes<HTMLInputElement> &
  SelectMenuExtraProps<T>

const SelectMenu = <T extends string>({
  id,
  label,
  onChange,
  onBlur,
  defaultValue,
  options,
  ...rest
}: SelectMenuExtraProps<T>) => {
  return (
    <Wrapper>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="select">
        <select
          id={id}
          onChange={({ target: { value } }) => onChange(value as T)}
          onBlur={(event) => onBlur(event)}
          defaultValue={defaultValue}
          {...rest}
        >
          {options.map((o) => (
            <option value={o.value} key={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </Wrapper>
  )
}

export default SelectMenu
