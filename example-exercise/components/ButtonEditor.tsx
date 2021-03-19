import { Alternative } from "../pages/editor"
import styled from "styled-components"
interface Props {
  item: Alternative
}

const StyledButtonEditor = styled.div`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 500px;
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

const ButtonEditor = ({ item }: Props) => {
  return (
    <StyledButtonEditor>
      <InputCheckbox type="checkbox" />
      <Input value={item.name} />
      <DeleteButton>x</DeleteButton>
    </StyledButtonEditor>
  )
}

export default ButtonEditor
