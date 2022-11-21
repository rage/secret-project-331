/* eslint-disable i18next/no-literal-string */
import Editor from "@monaco-editor/react"
import _ from "lodash"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"
import { PublicSpec, Submission } from "../util/stateInterfaces"

interface Props {
  port: MessagePort
  initialPublicSpec: PublicSpec
  publicSpec: PublicSpec
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  port,
  publicSpec,
  initialPublicSpec,
}) => {
  const { t } = useTranslation()

  const initialEditorState = publicSpecToEditorState(initialPublicSpec)
  sendCurrentState(port, initialEditorState)
  const [editorState, _setEditorState] = useState(publicSpecToEditorState(publicSpec))
  const setEditorState = (value: Array<[string, string]>) => {
    _setEditorState(value)
    if (!port) {
      // eslint-disable-next-line i18next/no-literal-string
      console.error("Cannot send state to parent because I don't have a port")
      return
    }
    sendCurrentState(port, value)
  }

  // student exercise view
  if (publicSpec.type === "browser") {
    // "inline" exercise, solved in the browser
    // todo: support multiple files
    const [path, contents] = editorState[0]
    return (
      <>
        <div>{path}</div>
        <Editor
          height="30rem"
          width="100%"
          language={extensionToLanguage(path)}
          value={contents}
          onChange={(newContents) => {
            if (newContents !== undefined) {
              const newState = { ...editorState }
              newState[0][1] = newContents
              setEditorState(newState)
            }
          }}
        />
        <Button
          variant="primary"
          size="medium"
          onClick={() => {
            // cloneDeep prevents setState from changing the initial spec (??)
            setEditorState(_.cloneDeep(initialEditorState))
          }}
        >
          {t("reset")}
        </Button>
      </>
    )
  } else if (publicSpec.type === "editor") {
    // solved in an external editor
    return (
      <>
        <div>{t("solve-in-editor")}</div>
        <a download={"testts"} href={publicSpec.archiveDownloadUrl}>
          {t("download")}
        </a>
      </>
    )
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    throw "Unhandled exercise type"
  }
}

const publicSpecToEditorState = (publicSpec: PublicSpec): Array<[string, string]> => {
  if (publicSpec.type === "browser") {
    return publicSpec.files
  }
  return []
}

const extensionToLanguage = (path: string): string | undefined => {
  /* eslint-disable i18next/no-literal-string */
  const separator = path.lastIndexOf(".")
  if (separator == -1) {
    return undefined
  }
  const extension = path.substring(separator + 1)
  switch (extension) {
    case "js":
      return "javascript"
    case "ts":
      return "typescript"
    case "py":
    case "ipynb":
      return "python"
    case "cs":
      return "csharp"
    default:
      // try to use the extension as language,
      // works in most other cases like java, c...
      // an unknown language will just disable syntax highlighting so this won't cause problems
      return extension
  }
  /* eslint-enable i18next/no-literal-string */
}

const sendCurrentState = (port: MessagePort, files: Array<[string, string]>) => {
  // eslint-disable-next-line i18next/no-literal-string
  console.info("Posting state to parent")
  const data: Submission = {
    type: "browser",
    files,
  }
  const message: CurrentStateMessage = {
    // eslint-disable-next-line i18next/no-literal-string
    message: "current-state",
    data,
    valid: true,
  }
  port.postMessage(message)
}

export default AnswerExercise
