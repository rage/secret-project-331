"use client"

import React, { useCallback, useContext } from "react"

import { BlockRendererProps } from ".."

import ParsedText from "@/components/course-material/ParsedText"
import { CheckboxContext } from "@/contexts/course-material/CheckboxContext"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CheckBoxAttributes {
  content: string
}

const ResearchFormCheckBoxBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CheckBoxAttributes>>
> = (props) => {
  const { questionIdsAndAnswers, setQuestionIdsAndAnswers } = useContext(CheckboxContext)

  const handleChange = useCallback(
    (value: boolean) => {
      setQuestionIdsAndAnswers({ ...questionIdsAndAnswers, [props.data.clientId]: value })
    },
    [questionIdsAndAnswers, props.data.clientId, setQuestionIdsAndAnswers],
  )

  const renderFunction = useCallback(
    ({
      ref,
      count: _count,
      hasCitationsOrGlossary: _hasCitationsOrGlossary,
    }: {
      ref: (node: HTMLElement | null) => void
      count: number
      hasCitationsOrGlossary: boolean
    }) => {
      return (
        <CheckBox
          label=""
          labelIsRawHtml
          labelRef={ref}
          checked={questionIdsAndAnswers?.[props.data.clientId]}
          onChange={() => handleChange(!questionIdsAndAnswers?.[props.data.clientId])}
        />
      )
    },
    [questionIdsAndAnswers, props.data.clientId, handleChange],
  )

  if (!questionIdsAndAnswers) {
    return
  }

  return (
    <ParsedText
      text={props.data.attributes.content}
      useWrapperElement={true}
      render={renderFunction}
    />
  )
}

export default withErrorBoundary(ResearchFormCheckBoxBlock)
