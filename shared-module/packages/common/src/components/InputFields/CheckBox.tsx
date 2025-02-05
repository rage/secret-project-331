import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React, { forwardRef, InputHTMLAttributes } from "react"

import { baseTheme, primaryFont } from "../../styles"

const ERRORCOLOR = "#F76D82"
const DEFAULTCOLOR = "#787878"

interface LabelExtraProps {
  error?: boolean
}

const Label = styled.label<LabelExtraProps>`
  font-family: ${primaryFont};
  font-size: 1.1rem;
  line-height: 1.1;
  display: grid;
  grid-template-columns: 1em auto;
  gap: 0.5em;
  color: ${baseTheme.colors.gray[600]};

  input[type="checkbox"] {
    appearance: none;
    background-color: #fff;
    margin: 0;
    font: inherit;
    width: 1.15em;
    height: 1.1em;
    border: 2px solid ${({ error }) => (error ? ERRORCOLOR : DEFAULTCOLOR)};
    transform: translateY(-0.075em);
    display: grid;
    place-content: center;
  }

  input[type="checkbox"]:hover {
    background: #f9f9f9;
  }

  input[type="checkbox"]:before {
    content: "";
    width: 0.65em;
    height: 0.65em;
    transform: scale(0);
    transition: 120ms transform ease-in-out;
    box-shadow: inset 1em 1em #fff;
    clip-path: polygon(28% 38%, 41% 53%, 75% 24%, 86% 38%, 40% 78%, 15% 50%);
  }

  input[type="checkbox"]:checked {
    border-color: #37bc9b;
    background: #37bc9b;
  }
  input[type="checkbox"]:checked::before {
    transform: scale(1);
  }

  input[type="checkbox"]:disabled {
    color: #959495;
    cursor: not-allowed;
  }
`

const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

// Error string might change in the future

const ERROR = "Please check the secret box"

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: boolean
  checked?: boolean
  onChangeByValue?: (checked: boolean, name?: string) => void
  labelIsRawHtml?: boolean
}

const CheckBox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      onChangeByValue,
      onChange,
      className,
      checked,
      labelIsRawHtml = false,
      ...rest
    }: CheckboxProps,
    ref,
  ) => {
    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChangeByValue) {
        const {
          target: { checked },
        } = event
        onChangeByValue(checked)
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
          `,
          className,
        )}
      >
        <Label>
          <input
            type="checkbox"
            checked={checked}
            aria-errormessage={rest.error ? `${rest.label}_error` : undefined}
            aria-invalid={rest.error !== undefined}
            onChange={handleOnChange}
            ref={ref}
            {...rest}
          />
          {/* eslint-disable-next-line react/no-danger-with-children */}
          <span
            dangerouslySetInnerHTML={labelIsRawHtml ? { __html: rest.label } : undefined}
            // eslint-disable-next-line react/no-children-prop
            children={labelIsRawHtml ? undefined : rest.label}
          />
        </Label>
        {rest.error && (
          <span
            className={
              rest.error
                ? cx(error)
                : css`
                    visibility: hidden;
                    height: 0;
                    display: block;
                  `
            }
            id={`${rest.id ?? rest.label}_error`}
            role="alert"
          >
            {ERROR}
          </span>
        )}
      </div>
    )
  },
)

CheckBox.displayName = "CheckBox"
export default CheckBox
