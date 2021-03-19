import { useLayoutEffect, useRef } from "react"
import { Alternative } from "../pages/editor"
import styled from "styled-components"
interface Props {
  state: Alternative[]
  onHeightChange: (newHeight: number) => void
}

const Wrapper = styled.div`
  // Overflows break height calculations
  overflow: hidden;
`

const Editor = ({ state, onHeightChange }: Props) => {
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
      <pre>{JSON.stringify(state, undefined, 2)}</pre>
    </Wrapper>
  )
}

export default Editor
