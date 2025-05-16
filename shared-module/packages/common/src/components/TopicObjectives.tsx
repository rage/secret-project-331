import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Check from "../img/checkmark.svg"

/* export interface TopicObjectivesExtraProps {} */

const PLACEHOLDER_TEXT = "The passage experienced a surge in popularity during the 1960s."

const objectives = [
  { id: 1, objective: PLACEHOLDER_TEXT },
  { id: 2, objective: PLACEHOLDER_TEXT },
  { id: 3, objective: PLACEHOLDER_TEXT },
  { id: 4, objective: PLACEHOLDER_TEXT },
]

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;
  height: auto;
`
const Header = styled.div`
  background: #44827e;
  text-align: center;
  min-height: 55px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem;

  h2 {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    text-transform: uppercase;
    color: #ffffff;
  }
`
const Content = styled.div`
  padding: 2rem 2rem 3rem 2rem;
  background: rgba(229, 224, 241, 0.05);
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 30px;
  column-gap: 5px;
  border-right: 1px solid #e5e0f1;
  border-left: 1px solid #e5e0f1;
  border-bottom: 1px solid #e5e0f1;

  @media (max-width: 767.98px) {
    padding: 1rem 1rem 2rem 1rem;
    grid-template-columns: 1fr;
    row-gap: 25px;
  }
`
const StyledObjectives = styled.div`
  display: grid;
  grid-template-columns: 20px 1fr;
  span {
    margin-left: 15px;
    font-size: 20px;
    line-height: 1.3;
    font-style: normal;
    font-weight: 400;
    color: #535a66;
  }
`
const StyledCheck = styled(Check)`
  margin-top: 8px;
`

export type TopicObjectiveProps =
  React.HTMLAttributes<HTMLDivElement> /* & TopicObjectivesExtraProps */

const TopicObjectives: React.FC<React.PropsWithChildren<TopicObjectiveProps>> = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Header>
        <h2>{t("what-you-will-learn")}</h2>
      </Header>
      <Content>
        {objectives.map(({ id, objective }) => (
          <StyledObjectives key={id}>
            <StyledCheck />
            <span>{objective}</span>
          </StyledObjectives>
        ))}
      </Content>
    </Wrapper>
  )
}

export default TopicObjectives
