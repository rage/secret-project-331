import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

/* export interface InstructionBoxExtraProps {} */

const PLACEHOLDER_TEXT_ONE = "You must complete a certain percantage in each exercise."
const PLACEHOLDER_TEXT_TWO = "You must attempt all exercises in this chapter. "
const PLACEHOLDER_TEXT_THREE = "You can ask Henrik for answer  when in doubt. "

const instructions = [
  { id: 1, instruction: PLACEHOLDER_TEXT_ONE },
  { id: 2, instruction: PLACEHOLDER_TEXT_TWO },
  { id: 3, instruction: PLACEHOLDER_TEXT_THREE },
]

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;
  border: 3px solid #44827e;
  border-radius: 8px;
  font-size: 22px;
  font-weight: 300;
  color: #535a66;
  padding: 20px;
  height: auto;

  span {
    padding-left: 20px;
  }

  strong {
    color: #313947;
  }

  ol li:not(:last-child) {
    padding-bottom: 8px;
  }
`

export type InstructionBoxProps =
  React.HTMLAttributes<HTMLDivElement> /* & InstructionBoxExtraProps */

const InstructionBox: React.FC<InstructionBoxProps> = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <span>
        <strong>{t("tips")}!:</strong> {t("to-complete-this-chapter")}
      </span>
      <ol>
        {instructions.map(({ id, instruction }) => (
          <li key={id}>{instruction}</li>
        ))}
      </ol>
    </Wrapper>
  )
}

export default InstructionBox
