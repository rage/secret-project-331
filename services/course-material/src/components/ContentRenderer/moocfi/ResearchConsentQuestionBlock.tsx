import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { CheckboxContext } from "../../../contexts/CheckboxContext"
import { GlossaryContext } from "../../../contexts/GlossaryContext"
import { parseText } from "../util/textParsing"

import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CheckBoxAttributes {
  content: string
}

const ResearchFormCheckBoxBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CheckBoxAttributes>>
> = (props) => {
  const { terms } = useContext(GlossaryContext)

  const { questionIdsAndAnswers, setQuestionIdsAndAnswers } = useContext(CheckboxContext)

  const handleChange = (value: boolean) => {
    setQuestionIdsAndAnswers({ ...questionIdsAndAnswers, [props.data.clientId]: value })
  }

  if (!questionIdsAndAnswers) {
    return
  }

  return (
    <>
      <CheckBox
        label={parseText(props.data.attributes.content, terms).parsedText}
        labelIsRawHtml
        checked={questionIdsAndAnswers[props.data.clientId]}
        onChange={() => handleChange(!questionIdsAndAnswers[props.data.clientId])}
      />
    </>
  )
}

export default withErrorBoundary(ResearchFormCheckBoxBlock)
