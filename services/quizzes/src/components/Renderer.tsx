import dynamic from "next/dynamic"
import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { State } from "../pages/iframe"

import DynamicallyLoadingComponentPlaceholder from "./ComponentPlaceholder"

// Dynamic imports for different view types to keep the bundle size down
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <DynamicallyLoadingComponentPlaceholder />,
})
const Exercise = dynamic(() => import("./Exercise"), {
  ssr: false,
  loading: () => <DynamicallyLoadingComponentPlaceholder />,
})
const Submission = dynamic(() => import("./Submission"), {
  ssr: false,
  loading: () => <DynamicallyLoadingComponentPlaceholder />,
})

interface RendererProps {
  state: State | null
  setState: Dispatch<SetStateAction<State | null>>
  port: MessagePort | null
}

export const Renderer: React.FC<RendererProps> = ({ state, port }) => {
  const { t } = useTranslation()

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.viewType === "exercise") {
    return <Exercise port={port} quiz={state.publicSpec} />
  } else if (state.viewType === "view-submission") {
    return (
      <Submission
        publicAlternatives={state.publicSpec}
        modelSolutions={state.modelSolutions}
        user_answer={state.userAnswer}
        gradingFeedbackJson={state.gradingFeedbackJson}
      />
    )
  } else if (state.viewType === "exercise-editor") {
    return <Editor port={port} privateSpec={state.privateSpec} />
  } else {
    return <>{t("waiting-for-content")}</>
  }
}
