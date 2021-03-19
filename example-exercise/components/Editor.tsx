import { useLayoutEffect, useRef } from "react"
import { Alternative } from "../pages/editor"
import styled from "styled-components"
import ButtonEditor from "./ButtonEditor"
interface Props {
  state: Alternative[]
  setState: (newState: Alternative[]) => void
  onHeightChange: (newHeight: number) => void
}

const Wrapper = styled.div`
  // Overflows break height calculations
  overflow: hidden;
`

const ButtonWrapper = styled.div`
  padding: 5rem;
`

const NewButton = styled.button`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 500px;
  display: block;
  padding: 0.5rem;
  background-color: white;
  border 1px solid black;
  transition: all .3s;
  &:hover {
    background-color: #f1f1f1;
  }
`

const Editor = ({ state, setState, onHeightChange }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null)
  // Automatic height resizing events
  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height)
  })
  return (
    <Wrapper ref={contentRef}>
      <ButtonWrapper>
        {state.map((o) => (
          <ButtonEditor key={o.name} item={o} />
        ))}
        <NewButton
          onClick={() => {
            const newState = [...state]
            newState.push({ name: "", correct: false })
            setState(newState)
          }}
        >
          New
        </NewButton>
      </ButtonWrapper>
    </Wrapper>
  )
}

export default Editor
