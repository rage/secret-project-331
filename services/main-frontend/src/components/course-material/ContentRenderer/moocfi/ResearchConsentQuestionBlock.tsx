"use client"

import React, { useContext } from "react"

import ParsedText from "@/components/course-material/ParsedText"
import { CheckboxContext } from "@/contexts/course-material/CheckboxContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Checkbox } from "@/shared-module/components"

import type { BlockRendererProps } from ".."

interface CheckBoxAttributes {
  content: string
}

const ResearchFormCheckBoxBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CheckBoxAttributes>>
> = (props) => {
  const { control } = useContext(CheckboxContext)

  if (!control) {
    return null
  }

  return (
    <ParsedText
      text={props.data.attributes.content}
      useWrapperElement={true}
      render={({ ref }) => (
        <Checkbox name={props.data.clientId} control={control} label={<span ref={ref} />} />
      )}
    />
  )
}

export default withErrorBoundary(ResearchFormCheckBoxBlock)
