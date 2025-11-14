import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { CheckboxContext } from "../../../contexts/CheckboxContext"

import ParsedText from "@/components/ParsedText"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CheckBoxAttributes {
  content: string
}

const ResearchFormCheckBoxBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CheckBoxAttributes>>
> = (props) => {
  const { questionIdsAndAnswers, setQuestionIdsAndAnswers } = useContext(CheckboxContext)

  const handleChange = (value: boolean) => {
    setQuestionIdsAndAnswers({ ...questionIdsAndAnswers, [props.data.clientId]: value })
  }

  if (!questionIdsAndAnswers) {
    return
  }

  return (
    <ParsedText
      text={props.data.attributes.content}
      useWrapperElement={true}
      render={(rendered) => {
        return (
          <CheckBox
            label={rendered.__html}
            labelIsRawHtml
            checked={questionIdsAndAnswers[props.data.clientId]}
            onChange={() => handleChange(!questionIdsAndAnswers[props.data.clientId])}
          />
        )
      }}
    />
  )
}

export default withErrorBoundary(ResearchFormCheckBoxBlock)
