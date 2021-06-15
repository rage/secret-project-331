import { useLayoutEffect, useRef } from "react"
import styled from "@emotion/styled"
import ButtonEditor from "./ButtonEditor"
import { v4 } from "uuid"
import { Alternative } from "../util/stateInterfaces"
interface Props {
  state: Alternative[]
  setState: (newState: Alternative[]) => void
  onHeightChange: (newHeight: number, port: MessagePort) => void
  port: MessagePort
}

const Wrapper = styled.div`
  /* Overflows break height calculations */
  overflow: hidden;
  box-sizing: border-box;
`

const ButtonWrapper = styled.div`
  padding: 1rem;
`

const NewButton = styled.button`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 500px;
  display: block;
  padding: 0.5rem;
  background-color: white;
  border: 1px solid black;
  transition: all 0.3s;

  &:hover {
    background-color: #f1f1f1;
  }
`

const Editor: React.FC<Props> = ({ state, setState, onHeightChange, port }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  // Automatic height resizing events
  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })
  console.log(typeof state)
  return (
    <Wrapper ref={contentRef}>
      <ButtonWrapper>
        {state.map((o) => (
          <ButtonEditor
            key={o.id}
            item={o}
            onDelete={() => {
              const newState = state.filter((e) => e.id !== o.id)
              setState(newState)
            }}
            onChange={(task) => {
              const newState = state.map((e) => {
                if (e.id !== o.id) {
                  return e
                }
                return task
              })
              setState(newState)
            }}
          />
        ))}
        <NewButton
          onClick={() => {
            const newState = [...state]
            newState.push({ name: "", correct: false, id: v4() })
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
