import styled from '@emotion/styled'
import React from 'react'
import { primaryFont } from '../../../../shared-module/styles'

interface ToggleCardProps {
  state: boolean
  title: string
  description: string
}

interface ToggleSwitchProps {
  checked: boolean
}

const ToggleCardContainer = styled.div`
  background-color: #FAFAFA;
  border: 2px solid #E0E0E0;
  border-radius: 4px;
  padding: 16px;
  display: flex;
  flex-direction: row;
  margin: 8px 0px 8px 0px;
`

const ToggleCardDetails = styled.div`
  display: flex;
  flex-direction: column;
`

const ToggleCardTitle = styled.div`
  font-size: 18px;
  font-weight: bold;
  font-family: ${primaryFont};
  color: #333333;
`


const ToggleCardDescription = styled.div`
  font-size: 15px;
  font-weight: light;
  font-family: ${primaryFont};
  color: #989CA3;
`

const ToggleButton = styled.label`
  margin-left: auto;
  align-self: center;

  /* Styling */
  position: relative;
  width: 32px;
  height: 24px;

  input:checked + span::before {
    transform: translateX(10px);
  }

  input:checked + span {
    background-color: green;
  }
`


const ToggleButtonInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;
  :checked {
    background-color: green;
  }

`

const ToggleButtonSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 6px;
  background-color: #292D32;

  ::before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 4px;
    bottom: 5px;
    border-radius: 25%;
    background-color: white;
    transition: .2s;
  }
`

const RectangularSwitch: React.FC<ToggleSwitchProps> = ({ checked }) => (
  <ToggleButton>
    <ToggleButtonInput checked={checked} type="checkbox"/>
    <ToggleButtonSlider/>
  </ToggleButton>
)

const ToggleCard: React.FC<ToggleCardProps> = ({
  title, description, state
}) => {
  return (
    <ToggleCardContainer>
      <ToggleCardDetails>
        <ToggleCardTitle>
          { title }
        </ToggleCardTitle>
        <ToggleCardDescription>
          { description }
        </ToggleCardDescription>
      </ToggleCardDetails>
      <RectangularSwitch checked={state}/>
    </ToggleCardContainer>
  )
}

export default ToggleCard
