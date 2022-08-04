import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { HtmlRenderer, Parser as MarkdownParser } from "commonmark"
import KaTex from "katex"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import TextField from "../shared-module/components/InputFields/TextField"

import TextNode from "./TextNode"

interface ITextEditorProps {
  latex?: boolean
  markdown?: boolean
  onChange: (value: string, name?: string) => void
  label: string
  text: string
}

const ToggleButtonStyle = css`
  font-size: 0.8rem;
  margin-left: 0.5rem;
  white-space: normal;
  width: 120px;
  height: 60%;
  top: 32%;
`

const EditorWrapper = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 80px;
`

const FlexWrapper = styled.div`
  flex: 1;
`
const KATEX_OUTPUT_FORMAT = "mathml"
const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const MARKDOWN_REGEX = /\[markdown\](.*?)\[\/markdown\]/g
type PairArray<T, K> = [T, K][]

const TextEditor: React.FC<ITextEditorProps> = ({
  latex = false,
  markdown = false,
  onChange,
  label,
  text,
}) => {
  const { t } = useTranslation()
  const [preview, setPreview] = useState(false)
  const markdownParser = new MarkdownParser()
  const htmlWriter = new HtmlRenderer()
  const INVALID_FORMAT_MESSAGE = "Invalid format: Make sure the tags are not overlapping"

  /**
   * Validate the text by check if there is overlapping tags.
   * e.g. the following are invalid
   * '[latex][markdown][/latex][markdown]'
   * '[latex][markdown][/markdown][/latex]'
   * '[latex][latex][/latex][/latex]'
   * @param text Text in the editor
   * @returns true if the text does not have overlapping tags
   */
  const validateText = (text: string) => {
    if ((latex && !markdown) || (!latex && markdown)) {
      return true
    }

    const latexLocations: PairArray<number, number> = []
    const markdownLocations: PairArray<number, number> = []

    let match
    while ((match = LATEX_REGEX.exec(text)) !== null) {
      latexLocations.push([match.index, LATEX_REGEX.lastIndex])
    }
    while ((match = MARKDOWN_REGEX.exec(text)) !== null) {
      markdownLocations.push([match.index, MARKDOWN_REGEX.lastIndex])
    }

    // Index in latex array
    let lindex = 0
    // Index in markdown array
    let mindex = 0
    const array: PairArray<number, number> = []

    while (lindex < latexLocations.length || mindex < markdownLocations.length) {
      if (lindex >= latexLocations.length) {
        array.push(markdownLocations[mindex])
        mindex++
        continue
      }

      if (mindex >= markdownLocations.length) {
        array.push(latexLocations[lindex])
        lindex++
        continue
      }

      if (latexLocations[lindex][0] < markdownLocations[mindex][0]) {
        array.push(latexLocations[lindex])
        lindex++
      } else {
        array.push(markdownLocations[mindex])
        mindex++
      }
    }

    for (let i = 0; i < array.length - 1; i++) {
      if (
        (array[i][0] < array[i + 1][0] && array[i + 1][0] < array[i][1]) ||
        (array[i][0] < array[i + 1][1] && array[i + 1][1] < array[i][1])
      ) {
        return false
      }
    }

    return true
  }

  const togglePreview = () => {
    setPreview(!preview)
  }

  const parseLatex = (text: string) => {
    return KaTex.renderToString(text, {
      throwOnError: false,
      displayMode: true,
      output: KATEX_OUTPUT_FORMAT,
    })
  }

  const parseMarkdown = (text: string) => {
    return htmlWriter.render(markdownParser.parse(text))
  }

  const formatText = (text: string) => {
    if ((latex || markdown) && !validateText(text)) {
      return INVALID_FORMAT_MESSAGE
    }
    let formattedText = text
    if (latex) {
      formattedText = formattedText.replace(LATEX_REGEX, (_, latex) => parseLatex(latex))
    }

    if (markdown) {
      formattedText = formattedText.replace(MARKDOWN_REGEX, (_, markdown) =>
        parseMarkdown(markdown),
      )
    }

    return formattedText
  }

  return (
    <EditorWrapper>
      <FlexWrapper>
        {preview ? (
          <TextNode text={formatText(text)} />
        ) : (
          <TextField value={text} label={label} disabled={false} onChange={onChange} />
        )}
      </FlexWrapper>
      <Button
        transform="capitalize"
        variant="outlined"
        size={"medium"}
        onClick={togglePreview}
        className={ToggleButtonStyle}
      >
        {t("markdown-preview")}
      </Button>
    </EditorWrapper>
  )
}

export default TextEditor
