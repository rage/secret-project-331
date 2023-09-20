import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button } from "@mui/material"
import { Pencil } from "@vectopus/atlas-icons-react"
import { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../types/types"
import { setAdvancedEditing } from "../../../store/editor/itemVariables/itemVariableActions"
import { decreasedItemOrder, increasedItemOrder } from "../../../store/editor/items/itemAction"

import CheckBoxContent from "./CheckBoxContent"
import CustomFrontend from "./CustomFrontend"
import EssayContent from "./EssayContent"
import MatrixContent from "./MatrixContent"
import MultipleChoiceContent from "./MultipleChoiceContent"
import OpenContent from "./OpenContent"
import ScaleContent from "./ScaleContent"
import Timeline from "./Timeline"

const TypeWrapper = styled.div`
  display: flex;
  align-items: center;
`

const QuizItemContainer = styled.div`
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
`

const Container = styled.div`
  padding: 1rem;
  border: 1px solid black;
  margin-bottom: 1rem;
`

const ControlButton = styled(Button)`
  height: 20px;
`

const ControlIcon = styled(FontAwesomeIcon)`
  height: 1.2rem !important;
  width: 1.2rem !important;
`

interface QuizItemProps {
  item: NormalizedQuizItem
}

const QuizItem: React.FC<React.PropsWithChildren<QuizItemProps>> = ({ item }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  return (
    <Container>
      <TypeWrapper>
        <h4>{item.type}</h4>
        <ControlButton onClick={() => dispatch(decreasedItemOrder(item.id))}>
          <ControlIcon icon={faAngleUp} />
        </ControlButton>
        <ControlButton onClick={() => dispatch(increasedItemOrder(item.id))}>
          <ControlIcon icon={faAngleDown} />
        </ControlButton>
        <div
          className={css`
            flex: 1;
          `}
        />
        <ControlButton
          onClick={(event) =>
            dispatch(
              setAdvancedEditing({
                itemId: item.id,
                editing: true,
                mouseClickYPosition: event.pageY,
              }),
            )
          }
          title={t("edit-item")}
        >
          <Pencil size={19} />
        </ControlButton>
      </TypeWrapper>
      <QuizItemContainer>{contentBasedOnType(item.type, item, t)}</QuizItemContainer>
    </Container>
  )
}

const contentBasedOnType = (type: string, item: NormalizedQuizItem, t: TFunction) => {
  switch (type) {
    case "multiple-choice":
    case "multiple-choice-dropdown":
    case "clickable-multiple-choice": {
      return <MultipleChoiceContent item={item} />
    }
    case "checkbox": {
      return <CheckBoxContent item={item} />
    }
    case "essay": {
      return <EssayContent item={item} />
    }
    case "open": {
      return <OpenContent item={item} />
    }
    case "scale": {
      return <ScaleContent item={item} />
    }
    case "matrix": {
      return <MatrixContent item={item} />
    }
    case "custom-frontend-accept-data": {
      return <CustomFrontend item={item} />
    }
    case "timeline": {
      return <Timeline item={item} />
    }
    default: {
      return (
        <div>
          <>{t("unsupported")}</>
        </div>
      )
    }
  }
}

export default QuizItem
