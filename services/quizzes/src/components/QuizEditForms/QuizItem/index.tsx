import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { decreasedItemOrder, increasedItemOrder } from "../../../store/editor/items/itemAction"
import { NormalizedItem } from "../../../types/NormalizedQuiz"

import CheckBoxContent from "./CheckBoxContent"
import ClickableMultipleChoiceContent from "./ClickableMultipleChoiceContent"
import CustomFrontend from "./CustomFrontend"
import EssayContent from "./EssayContent"
import MultipleChoiceContent from "./MultipleChoiceContent"
import MultipleChoiceDropdownContent from "./MultipleChoiceDropdownContent"
import OpenContent from "./OpenContent"
import ScaleContent from "./ScaleContent"

const TypeWrapper = styled.div`
  display: flex;
`

const QuizItemContainer = styled.div`
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
`

interface QuizItemProps {
  item: NormalizedItem
}

const QuizItem: React.FC<QuizItemProps> = ({ item }) => {
  const dispatch = useDispatch()

  return (
    <>
      <TypeWrapper>
        <h4>{item.type}</h4>
        <Button onClick={() => dispatch(decreasedItemOrder(item.id))}>
          <FontAwesomeIcon icon={faAngleUp} size="2x" />
        </Button>
        <Button onClick={() => dispatch(increasedItemOrder(item.id))}>
          <FontAwesomeIcon icon={faAngleDown} size="2x" />
        </Button>
      </TypeWrapper>
      <QuizItemContainer>{contentBasedOnType(item.type, item)}</QuizItemContainer>
    </>
  )
}

const contentBasedOnType = (type: string, item: NormalizedItem) => {
  switch (type) {
    case "multiple-choice": {
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
    case "custom-frontend-accept-data": {
      return <CustomFrontend item={item} />
    }
    case "multiple-choice-dropdown": {
      return <MultipleChoiceDropdownContent item={item} />
    }
    case "clickable-multiple-choice": {
      return <ClickableMultipleChoiceContent item={item} />
    }
    default: {
      return <h1>Hi, I am new/unknown</h1>
    }
  }
}

export default QuizItem
