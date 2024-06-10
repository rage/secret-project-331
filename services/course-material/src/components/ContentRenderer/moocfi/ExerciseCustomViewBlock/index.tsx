import React from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import CustomViewIframe from "./CustomViewIframe"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExerciseCustomViewBlockAttributes {
  exercise_type: string | undefined
  exercise_iframe_url: string | undefined
}

const ExerciseCustomViewBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExerciseCustomViewBlockAttributes>>
> = (props) => {
  const { t } = useTranslation()
  if (props.data.attributes.exercise_type === undefined) {
    return (
      <ErrorBanner variant="readOnly" error={t("error-no-exercise-type-selected")}></ErrorBanner>
    )
  }
  return (
    <CustomViewIframe
      url={props.data.attributes.exercise_iframe_url}
      exerciseServiceSlug={props.data.attributes.exercise_type}
      title={t("custom-view-iframe-title")}
    />
  )
}

export default withErrorBoundary(ExerciseCustomViewBlock)
