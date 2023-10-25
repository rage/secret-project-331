// This page is not translated because this page is a development tool and using different languages here would just create confusing terminology and weird language.
/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { isServer } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"

import PlaygroundAnswers from "../components/page-specific/playground-views/PlaygroundAnswers"
import PlaygroundPreview from "../components/page-specific/playground-views/PlaygroundPreview"
import PlayGroundSettings from "../components/page-specific/playground-views/PlaygroundSettings"
import PlaygroundSpecs from "../components/page-specific/playground-views/PlaygroundSpecs"
import useParsedPrivateSpec from "../hooks/playground/useParsedPrivateSpec"
import usePlaygroundQueriesAndMutations from "../hooks/playground/usePlaygroundQueriesAndMutations"
import { baseTheme } from "../shared-module/styles"
import { narrowContainerWidthPx } from "../shared-module/styles/constants"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

const TABS = [
  {
    id: "settings",
    label: "Settings",
  },
  {
    id: "specs",
    label: "Specs",
  },
  {
    id: "answers",
    label: "Answers",
  },
  {
    id: "preview",
    label: "Preview",
  },
]

export interface PlaygroundSettings {
  url: string
  width: string
  private_spec: string
  showIframeBorders: boolean
  disableSandbox: boolean
  pseudonymousUserId: string
  signedIn: boolean
}

const PUBLIC_ADDRESS = isServer ? "https://courses.mooc.fi" : new URL(window.location.href).origin
export const DEFAULT_SERVICE_INFO_URL = `${PUBLIC_ADDRESS}/example-exercise/api/service-info`

let PlaygroudTabs = () => {
  // Settings
  const settingsForm = useForm<PlaygroundSettings>({
    mode: "onChange",
    defaultValues: {
      url: localStorage.getItem("service-info-url") ?? DEFAULT_SERVICE_INFO_URL,
      width: narrowContainerWidthPx.toString(),

      private_spec: "null",
      showIframeBorders: true,
      disableSandbox: false,

      pseudonymousUserId: "78b62532-b836-4387-8f99-673cb023b903",
      signedIn: true,
    },
  })

  const url = settingsForm.watch("url")
  const privateSpec = settingsForm.watch("private_spec")

  // Rest
  const [currentView, setCurrentView] = useState<string>("settings")
  const [userAnswer, setUserAnswer] = useState<unknown>(null)
  const parsedPrivateSpec = useParsedPrivateSpec(privateSpec)
  const {
    serviceInfoQuery,
    isValidServiceInfo,
    publicSpecQuery,
    modelSolutionSpecQuery,
    submitAnswerMutation,
    exerciseServiceHost,
  } = usePlaygroundQueriesAndMutations({
    url,
    parsedPrivateSpec,
    setUserAnswer,
  })

  return (
    <div>
      <div
        className={css`
          background-color: ${baseTheme.colors.clear[200]};
          padding: 0.75rem;

          button {
            background-color: ${baseTheme.colors.clear[200]};
            border-radius: 0.5rem;
            border: none;
            padding: 0.5rem;
            margin: 0 0.5rem;
            cursor: pointer;

            &:hover {
              filter: contrast(1.2) brightness(0.88);
            }

            &[data-active="1"] {
              background-color: white;

              &:hover {
                filter: unset;
                cursor: unset;
              }
            }
          }
        `}
      >
        {TABS.map((tab) => (
          <button
            data-active={currentView === tab.id && "1"}
            key={tab.id}
            onClick={() => setCurrentView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        <div
          // Using display: none instead of conditional rendering because we don't want to cause rerenders when the user switches back and forth between tabs.
          className={css`
            ${currentView !== "settings" && `display: none;`}
          `}
        >
          <PlayGroundSettings
            settingsForm={settingsForm}
            serviceInfoQuery={serviceInfoQuery}
            isValidServiceInfo={isValidServiceInfo}
          />
        </div>
        <div
          className={css`
            ${currentView !== "specs" && `display: none;`}
          `}
        >
          <PlaygroundSpecs
            settingsForm={settingsForm}
            publicSpecQuery={publicSpecQuery}
            modelSolutionSpecQuery={modelSolutionSpecQuery}
          />
        </div>
        <div
          className={css`
            ${currentView !== "answers" && `display: none;`}
          `}
        >
          <PlaygroundAnswers userAnswer={userAnswer} submitAnswerMutation={submitAnswerMutation} />
        </div>
        <div
          className={css`
            ${currentView !== "preview" && `display: none;`}
          `}
        >
          <PlaygroundPreview
            serviceInfoQuery={serviceInfoQuery}
            isValidServiceInfo={isValidServiceInfo}
            exerciseServiceHost={exerciseServiceHost}
            parsedPrivateSpec={parsedPrivateSpec}
            publicSpecQuery={publicSpecQuery}
            modelSolutionSpecQuery={modelSolutionSpecQuery}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            submitAnswerMutation={submitAnswerMutation}
            settingsForm={settingsForm}
          />
        </div>
      </div>
    </div>
  )
}
// @ts-expect-error: Have to do this this way to use the error boundary with the noVisibleLayout property
PlaygroudTabs = withErrorBoundary(PlaygroudTabs)
export default PlaygroudTabs
// @ts-expect-error Custom property on Component, hides the layout on a page
PlaygroudTabs.noVisibleLayout = true
