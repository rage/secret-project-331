import styled from "@emotion/css"
import KaTex from "katex"
import React, { useState } from "react"

const Wrapper = styled.div`
  display: flex;
`

const Component = styled.div`
  height: 50%;
  width: 100%;
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
    <Wrapper>
      <Component>
        <h2> Preview: </h2>
        {convert_to_latex()}
      </Component>
      <Component>
        <textarea value={input} onChange={update} />
      </Component>
    </Wrapper>
  )
}

export default LatexEditor
