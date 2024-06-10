import styled from "@emotion/styled"
import React, { useId } from "react"

import { primaryFont } from "@/shared-module/common/styles"

interface ToggleCardProps {
  state: boolean
  title: string
  description: string
  onChange: (value: boolean) => void
  disabled?: boolean
}

interface ToggleSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  id: string
}

const NONE = "none"
const UNSET = "unset"

const ToggleCardContainer = styled.div<{ disabled: boolean }>`
  background-color: #fafafa;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  display: flex;
  flex-direction: row;
  margin: 8px 0px 8px 0px;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? NONE : UNSET)};
`

const ToggleCardDetails = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-right: 0.5rem;
`

const ToggleCardTitle = styled.label`
  font-size: 18px;
  font-weight: bold;
  font-family: ${primaryFont};
  color: #333333;
`

const ToggleCardDescription = styled.div`
  font-size: 15px;
  font-weight: light;
  font-family: ${primaryFont};
  color: #989ca3;
`

const RectangularSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, id }) => (
  <input
    id={id}
    checked={checked}
    type="checkbox"
    onChange={(_) => {
      onChange(!checked)
    }}
  />
)

const ToggleCard: React.FC<ToggleCardProps> = ({
  title,
  description,
  state,
  onChange,
  disabled = false,
}) => {
  const id = useId()
  return (
    <ToggleCardContainer disabled={disabled}>
      <ToggleCardDetails>
        <ToggleCardTitle htmlFor={id}>{title}</ToggleCardTitle>
        <ToggleCardDescription>{description}</ToggleCardDescription>
      </ToggleCardDetails>
      <RectangularSwitch id={id} checked={state} onChange={onChange} />
    </ToggleCardContainer>
  )
}

export default ToggleCard
