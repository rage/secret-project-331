import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { Alternative } from "../util/stateInterfaces"

import ButtonEditor from "./ButtonEditor"
interface Props {
  state: Alternative[]
  setState: (newState: Alternative[]) => void
  maxWidth: number
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

const Editor: React.FC<Props> = ({ state, setState, port }) => {
  const { t } = useTranslation()
  return (
    <HeightTrackingContainer port={port}>
      <ButtonWrapper>
        {state.map((o) => (
          <ButtonEditor
            key={o.id}
            item={o}
            onDelete={() => {
              const newState = state.filter((e) => e.id !== o.id)
              setState(newState)
            }}
            onChange={(task) => {
              const newState = state.map((e) => {
                if (e.id !== o.id) {
                  return e
                }
                return task
              })
              setState(newState)
            }}
          />
        ))}
        <NewButton
          onClick={() => {
            const newState = [...state]
            newState.push({ name: "", correct: false, id: v4() })
            setState(newState)
          }}
        >
          {t("new")}
        </NewButton>
      </ButtonWrapper>
    </HeightTrackingContainer>
  )
}

export default Editor
