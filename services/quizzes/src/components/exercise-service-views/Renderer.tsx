import dynamic from "next/dynamic"
import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { State } from "../../pages/iframe"
import DynamicallyLoadingComponentPlaceholder from "../ComponentPlaceholder"

import { EXERCISE_SERVICE_CONTENT_ID } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"

// Dynamic imports for different view types to keep the bundle size down
const ExerciseEditor = dynamic(() => import("./ExerciseEditor"), {
  ssr: false,
  loading: () => <DynamicallyLoadingComponentPlaceholder />,
})
const AnswerExercise = dynamic(() => import("./AnswerExercise"), {
  ssr: false,
  loading: () => <DynamicallyLoadingComponentPlaceholder />,
})
const ViewSubmission = dynamic(() => import("./ViewSubmission"), {
  ssr: false,
  loading: () => <DynamicallyLoadingComponentPlaceholder />,
})

interface RendererProps {
  state: State | null
  setState: Dispatch<SetStateAction<State | null>>
  port: MessagePort | null
}

const Renderer: React.FC<React.PropsWithChildren<RendererProps>> = ({ state, port }) => {
  const { t } = useTranslation()

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.viewType === "answer-exercise") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="answer-exercise">
        <AnswerExercise
          port={port}
          publicSpec={state.publicSpec}
          previousSubmission={state.previousSubmission}
          user_information={state.userInformation}
        />
      </div>
    )
  } else if (state.viewType === "view-submission") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="view-submission">
        <ViewSubmission
          publicAlternatives={state.publicSpec}
          modelSolutions={state.modelSolutions}
          user_answer={state.userAnswer}
          gradingFeedbackJson={state.gradingFeedbackJson}
          user_information={state.userInformation}
        />
      </div>
    )
  } else if (state.viewType === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="exercise-editor">
        <ExerciseEditor port={port} privateSpec={state.privateSpec} />
      </div>
    )
  } else {
    return <>{t("waiting-for-content")}</>
  }
}

export default withErrorBoundary(withNoSsr(Renderer))
