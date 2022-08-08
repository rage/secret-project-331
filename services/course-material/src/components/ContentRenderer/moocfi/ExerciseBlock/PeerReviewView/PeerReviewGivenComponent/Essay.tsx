import styled from "@emotion/styled"
import * as React from "react"
import { useTranslation } from "react-i18next"

const Wrapper = styled.div`
  padding: 1rem;

  h4 {
    font-size: 16px !important;
    color: #215887;
    line-height: 1.4;
    margin-bottom: 0.8rem;
  }

  span {
    color: #535a66;
  }
`

interface EssayProps {
  question: string
  index: number
  content: string | number
}

const Essay: React.FunctionComponent<EssayProps> = ({ question, content, index }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      {""}
      <h4>{`${t("question")} ${index + 1}: ${question}`}</h4>
      <span>{content}</span>
    </Wrapper>
  )
}

export default Essay
