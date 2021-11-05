import React from 'react'
import styled from '@emotion/styled'

type OptionType = {
  value: string,
  label: string,
  id: string
}

const options: OptionType[] = [
  {value: '', label: 'Select a name', id: ''},
  {value: 'Henrik', label: 'Henrik', id: 'henrik'},
  {value: 'Sebastien', label: 'Sebastien', id: 'sebastien'},
  {value: 'Pekka', label: 'Pekka', id: 'pekka'},
  {value: 'Teemu', label: 'Teemu', id: 'teemu'}
]

interface SelectMenuExtraProps {
  name: string
  label: string
  errorMessage?: string
  value?: string
/*   onBlur?: (name?:string) => void */
  onChange: (value:string, name?:string) => void
}

const Wrapper = styled.div``

export type SelectMenuProps = React.HTMLAttributes<HTMLInputElement> & SelectMenuExtraProps

const SelectMenu = ({onChange, ...rest}: SelectMenuExtraProps) => {

  return (
    <Wrapper>
      <label htmlFor={rest.name}>{rest.label}</label>
      <select onChange={({ target: { value } }) => onChange(value)} {...rest} >
        {options.map((o) =>(
          <option value={o.value}>{o.label}</option>
        ))}
      </select>
    </Wrapper>
  )
}

export default SelectMenu;
