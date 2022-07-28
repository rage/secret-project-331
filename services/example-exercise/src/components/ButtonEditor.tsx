import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { Alternative } from "../util/stateInterfaces"
interface Props {
  item: Alternative
  onDelete: () => void
  onChange: (item: Alternative) => void
}

const StyledButtonEditor = styled.div`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  border: 1px solid black;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-apart;
`

const Input = styled.input`
  padding: 0.5rem;
  width: 100%;
  margin: 0 auto;
  margin-right: 0.5rem;
`

const InputCheckbox = styled.input`
  margin: 0 auto;
  margin-right: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
`

const DeleteButton = styled.button`
  width: 2rem;
  height: 2rem;
`

const ButtonEditor: React.FC<React.PropsWithChildren<Props>> = ({ item, onDelete, onChange }) => {
  const { t } = useTranslation()
  return (
    <StyledButtonEditor>
      <InputCheckbox
        type="checkbox"
        checked={item.correct || false}
        onChange={(e) => {
          onChange({ ...item, correct: e.target.checked })
        }}
      />
      <Input
        placeholder={t("input-placeholder-option-text")}
        value={item.name}
        onChange={(e) => {
          onChange({ ...item, name: e.target.value })
        }}
      />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <DeleteButton onClick={onDelete}>x</DeleteButton>
    </StyledButtonEditor>
  )
}

export default ButtonEditor
