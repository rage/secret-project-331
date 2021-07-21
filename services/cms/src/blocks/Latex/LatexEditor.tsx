import { css } from "@emotion/css"
import styled from "@emotion/styled"
import KaTex from "katex"
import React, { useState } from "react"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid black;
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
    const output = KaTex.renderToString(input, {
      throwOnError: false,
      displayMode: true,
      output: "mathml",
    })
    return <div dangerouslySetInnerHTML={{ __html: output }} />
  }

  return (
    <Container>
      <Component>
        <textarea
          className={css`
            width: 98%;
            height: 90%;
            margin: 4px;
            resize: none;
          `}
          value={input}
          onChange={update}
        />
      </Component>
      <Component>{convert_to_latex()}</Component>
    </Container>
  )
}

export default LatexEditor
