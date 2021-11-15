import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { SubmissionState } from "../pages/iframe"
import { Alternative, PublicAlternative } from "../util/stateInterfaces"

import Editor from "./Editor"
import Exercise from "./Exercise"
import Submission from "./Submission"

interface RendererProps {
  viewType: "exercise" | "view-submission" | "exercise-editor"
  state: SubmissionState | Alternative[] | PublicAlternative[]
  setState: Dispatch<SetStateAction<SubmissionState | PublicAlternative[] | Alternative[] | null>>
  port: MessagePort
  maxWidth: number
}

export const Renderer: React.FC<RendererProps> = ({
  viewType,
  state,
  setState,
  port,
  maxWidth,
}) => {
  const { t } = useTranslation()
  const [rendererState, setRendererState] = useState<any>(state)
  useEffect(() => {
    setRendererState(state)
  }, [viewType, state])
  if (viewType === "exercise") {
    // eslint-disable-next-line i18next/no-literal-string
    console.log("rendering exercise")
    return <Exercise maxWidth={maxWidth} port={port} state={rendererState as PublicAlternative[]} />
  } else if (viewType === "view-submission") {
    // eslint-disable-next-line i18next/no-literal-string
    console.log("rendering submission")
    return <Submission port={port} maxWidth={maxWidth} state={rendererState as SubmissionState} />
  } else if (viewType === "exercise-editor") {
    // eslint-disable-next-line i18next/no-literal-string
    console.log("rendering editor")
    return (
      <Editor
        state={rendererState as Alternative[]}
        maxWidth={maxWidth}
        port={port}
        setState={setState}
      />
    )
  } else {
    return <>{t("waiting-for-content")}</>
  }
}
