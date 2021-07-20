import styled from "@emotion/styled"
import KaTex from "katex"
import React, { useState } from "react"

const Container = styled.div`
  display: flex;
  flex-direction: column;
`

const Component = styled.div`
  flex: 50%;
  padding: 10px;
`

const LatexEditor: React.FC = () => {
  const [input, setInput] = useState("")

  const update = (event) => {
    setInput(event.target.value)
  }

  const convert_to_latex = () => {
    const output = KaTex.renderToString(input)
    return <div dangerouslySetInnerHTML={output} />
  }

  return (
    <Container>
      <Component>
        <h2> Preview: </h2>
        {convert_to_latex()}
      </Component>
      <Component>
        <textarea value={input} onChange={update} />
      </Component>
    </Container>
  )
}

export default LatexEditor
