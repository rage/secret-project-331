import styled from "@emotion/styled"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import ButtonEditor from "./ButtonEditor"
import { State } from "./IframeView"

import { CurrentStateMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { baseTheme } from "@/styles/theme"
import { Alternative, toVersionedPrivateSpec, validatePrivateSpec } from "@/util/stateInterfaces"
import { generateUuid } from "@/util/uuid"

const CURRENT_STATE = "current-state"
interface Props {
  state: Alternative[]
  setState: (newState: State) => void
  port: MessagePort
}

const ButtonWrapper = styled.div`
  padding: 1rem 0;
`

const NewButton = styled.button`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  display: block;
  padding: 0.5rem;
  background-color: white;
  border: 1px solid black;
  transition: all 0.3s;

  &:hover {
    background-color: #f1f1f1;
  }
`

const ErrorList = styled.ul`
  margin: 0 0 1rem;
  padding: 0.75rem 1rem 0.75rem 2rem;
  border-radius: 0.25rem;
  background-color: ${baseTheme.semantic.error.background};
  color: ${baseTheme.semantic.error.text};
`

const Editor: React.FC<React.PropsWithChildren<Props>> = ({ state, setState, port }) => {
  const { t } = useTranslation()

  // `validatePrivateSpec` is the single validity authority: its result drives both the `valid` flag
  // the host uses to gate saving AND the errors shown to the author below.
  const validation = validatePrivateSpec(state)

  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      // persist-on-save: emit the current versioned envelope so the next save stores it.
      data: { private_spec: toVersionedPrivateSpec(state) },
      message: CURRENT_STATE,
      valid: validatePrivateSpec(state).valid,
    }
    port.postMessage(message)
  }, [state, port])

  return (
    <ButtonWrapper>
      {validation.errors.length > 0 && (
        <ErrorList role="alert" aria-label={t("validation-errors-heading")}>
          {validation.errors.map((error) => (
            <li key={error}>{t(error)}</li>
          ))}
        </ErrorList>
      )}
      {state.map((o) => (
        <ButtonEditor
          key={o.id}
          item={o}
          onDelete={() => {
            const newState = state.filter((e) => e.id !== o.id)
            // eslint-disable-next-line i18next/no-literal-string
            setState({ view_type: "exercise-editor", private_spec: newState })
          }}
          onChange={(task) => {
            const newState = state.map((e) => {
              if (e.id !== o.id) {
                return e
              }
              return task
            })
            // eslint-disable-next-line i18next/no-literal-string
            setState({ view_type: "exercise-editor", private_spec: newState })
          }}
        />
      ))}
      <NewButton
        onClick={() => {
          const newState = [...state]
          newState.push({ name: "", correct: false, id: generateUuid() })
          // eslint-disable-next-line i18next/no-literal-string
          setState({ view_type: "exercise-editor", private_spec: newState })
        }}
      >
        {t("new")}
      </NewButton>
    </ButtonWrapper>
  )
}

export default Editor
