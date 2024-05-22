import styled from "@emotion/styled"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { State } from "../pages/iframe"
import { Alternative } from "../util/stateInterfaces"

import ButtonEditor from "./ButtonEditor"

import { CurrentStateMessage } from "@/shared-module/common/exercise-service-protocol-types"

const CURRENT_STATE = "current-state"
interface Props {
  state: Alternative[]
  setState: (newState: State) => void
  port: MessagePort
}

// eslint-disable-next-line i18next/no-literal-string
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

const Editor: React.FC<React.PropsWithChildren<Props>> = ({ state, setState, port }) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      data: { private_spec: state },
      message: CURRENT_STATE,
      valid: true,
    }
    port.postMessage(message)
  }, [state, port])

  return (
    <ButtonWrapper>
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
          newState.push({ name: "", correct: false, id: v4() })
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
