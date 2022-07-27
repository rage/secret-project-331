import styled from "@emotion/styled"
import * as React from "react"

import Essay from "./Essay"
import Linkert from "./Linkert"

interface ReviewProps {
  orderNumber: number
}

const Wrapper = styled.div`
  background: #f5f6f7;
  margin-bottom: 10px;
  padding: 0 !important;
`
const Heading = styled.div`
  padding: 1rem;
  border-bottom: 2px solid #ebedee;
`

const arr = [
  {
    // eslint-disable-next-line i18next/no-literal-string
    peerReviewType: "essay",
    // eslint-disable-next-line i18next/no-literal-string
    question: "What is your opinion regarding the structure of the answer givern by student A",
    // eslint-disable-next-line i18next/no-literal-string
    content: "Lorem ipsum is a placeholder",
  },
  {
    // eslint-disable-next-line i18next/no-literal-string
    peerReviewType: "linkert",
    // eslint-disable-next-line i18next/no-literal-string
    question: "Do you think the answer is sufficient",
    content: 4,
  },
]

const HEADING_PLACEHOLDER = "Peer review"

const Reviews: React.FunctionComponent<ReviewProps> = ({ orderNumber }) => {
  return (
    <Wrapper>
      <Heading>{`${HEADING_PLACEHOLDER} #${orderNumber + 1}`}</Heading>
      {arr.map(({ peerReviewType, question, content }, index) =>
        peerReviewType === "essay" ? (
          <Essay question={question} content={content} index={index} />
        ) : (
          <Linkert question={question} content={content} index={index} />
        ),
      )}
    </Wrapper>
  )
}

export default Reviews
