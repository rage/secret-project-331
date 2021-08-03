import React, { useLayoutEffect, useRef } from "react"
import styled from "styled-components"

import QuizItems from "./QuizEditForms/QuizItems"

const Wrapper = styled.div`
  /* Overflows break height calculations */
  overflow: hidden;
  box-sizing: border-box;
`

interface StatelessEditorProps {
  onHeightChange: (newHeight: number) => void
}

const StatelessEditor: React.FC<StatelessEditorProps> = ({ onHeightChange }) => {
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height)
  })

  return (
    <Wrapper ref={contentRef}>
      <QuizItems />
    </Wrapper>
  )
}

export default StatelessEditor
