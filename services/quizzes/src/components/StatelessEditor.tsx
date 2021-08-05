import React, { useLayoutEffect, useRef } from "react"
import styled from "styled-components"

import BasicInformation from "./QuizEditForms/BasicInfo"
import QuizItems from "./QuizEditForms/QuizItems"

const Wrapper = styled.div`
  /* Overflows break height calculations */
  overflow: hidden;
  box-sizing: border-box;
`

interface StatelessEditorProps {
  onHeightChange: (newHeight: number, port: MessagePort) => void
  port: MessagePort
}

const StatelessEditor: React.FC<StatelessEditorProps> = ({ onHeightChange, port }) => {
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })

  return (
    <Wrapper ref={contentRef}>
      <BasicInformation />
      <QuizItems />
    </Wrapper>
  )
}

export default StatelessEditor
