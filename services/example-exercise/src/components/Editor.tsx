import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useLayoutEffect, useRef } from "react"
import { v4 } from "uuid"

import { Alternative } from "../util/stateInterfaces"

import ButtonEditor from "./ButtonEditor"
interface Props {
  state: Alternative[]
  setState: (newState: Alternative[]) => void
  onHeightChange: (newHeight: number, port: MessagePort) => void
  port: MessagePort
  maxWidth: number
}

const Wrapper = styled.div`
  /* Overflows break height calculations */
  overflow: hidden;
  box-sizing: border-box;
`

const ButtonWrapper = styled.div`
  padding: 1rem 0;
`

const NewButton = styled.button`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  display: block;
  padding: 0.5rem;
  background-color: white;
  border: 1px solid black;
  transition: all 0.3s;

  &:hover {
    background-color: #f1f1f1;
  }
`

const Editor: React.FC<Props> = ({ state, setState, onHeightChange, port, maxWidth }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  // Automatic height resizing events
  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })
  return (
    <Wrapper
      className={css`
        /* Overflows break height calculations */
        overflow: hidden;
        box-sizing: border-box;
        width: 100%;
        max-width: ${maxWidth}px;
        margin: 0 auto;
      `}
      ref={contentRef}
    >
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
