import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { BlockEditProps } from "@wordpress/blocks"
import KaTex from "katex"
import React from "react"

import "katex/dist/katex.min.css"
import { TextAttributes } from "."

const KATEX_OUTPUT_FORMAT = "htmlAndMathml"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid black;
`

const Component = styled.div`
  flex: 50%;
  padding: 10px;
`

const LatexEditor: React.FC<React.PropsWithChildren<BlockEditProps<TextAttributes>>> = (props) => {
  const { attributes, setAttributes } = props

  const update = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAttributes({
      text: event.target.value,
    })
  }

  const convert_to_latex = () => {
    const output = KaTex.renderToString(attributes.text, {
      throwOnError: false,
      displayMode: true,
      output: KATEX_OUTPUT_FORMAT,
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
          value={attributes.text}
          onChange={update}
        />
      </Component>
      <Component>{convert_to_latex()}</Component>
    </Container>
  )
}

export default LatexEditor
