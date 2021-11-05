import React from 'react'
import styled from '@emotion/styled'


interface RadioFieldExtraProps {
  label: string
  hint?: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
/*   onBlur?: (name?:string) => void */
  onChange: (value:string, name?:string) => void
}

export type RadioFieldProps = React.HTMLAttributes<HTMLInputElement> & RadioFieldExtraProps

const RadioField = ({onChange, ...rest}: RadioFieldExtraProps) => {

  return (
    <label><span>{rest.label}</span>
    <input type="radio" onChange={({ target: { value }}) => onChange(value)} {...rest} />
    </label>
  )
}

export default RadioField;
