import React from 'react'
import styled from '@emotion/styled'
interface CheckboxFieldExtraProps {
  label: string
  errorMessage?: string
  checked: boolean
/*   onBlur?: (name?:string) => void */
  onChange: (checked:boolean, name?:string) => void
}

export type CheckboxProps = React.HTMLAttributes<HTMLInputElement> & CheckboxFieldExtraProps

const RadioField = ({onChange, ...rest}: CheckboxFieldExtraProps) => {

  return (
    <label><span>{rest.label}</span>
    <input type="checbox" onChange={({ target: { checked }}) => onChange(checked)} {...rest} />
    </label>
  )
}

export default RadioField;
