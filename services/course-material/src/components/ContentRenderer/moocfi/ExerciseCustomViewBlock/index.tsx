import React from "react"

import { BlockRendererProps } from "../.."
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import CustomViewIframe from "./CustomViewIframe"

interface ExerciseCustomViewBlockAttributes {
  exercise_type: string | undefined
  exercise_iframe_url: string | undefined
}

const ExerciseCustomViewBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExerciseCustomViewBlockAttributes>>
> = (props) => {
  if (props.data.attributes.exercise_type === undefined) {
    return <ErrorBanner variant="readOnly" error={`No exercise_type selected`}></ErrorBanner>
  }
  return (
    <CustomViewIframe
      url={props.data.attributes.exercise_iframe_url}
      exerciseServiceSlug={props.data.attributes.exercise_type}
      title={"Some title here"}
    />
  )
}

export default withErrorBoundary(ExerciseCustomViewBlock)
