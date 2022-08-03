import { keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import * as React from "react"
import { useQuery } from "react-query"

import { fetchPeerReviewDataGivenByExerciseId } from "../../../../../../services/backend"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"

import Reviews from "./Reviews"

const openAnimation = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`

const slideDown = keyframes`
  from { opacity: 0; height: 0; padding: 0;}
  to { opacity: 1; height: 100%; padding: 10px;}
`
const PLACEHOLDER_HEADING = "Recieved peer review from other students"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  details {
    transition: all 0.3s ease-in-out;
  }

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.grey[700]};
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
    padding: 1rem 1rem 1rem 1rem;
  }

  details summary {
    padding: 1rem;
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
    font-weight: 500;
    font-family: ${headingFont};
    list-style: none;
    color: ${baseTheme.colors.grey[700]};
    outline: 0;
    background: ${baseTheme.colors.clear[100]};
    margin-bottom: 5px;
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: ${baseTheme.colors.grey[700]};
  }

  details summary:after {
    content: "+";
    position: absolute;
    font-size: 2.4rem;
    color: ${baseTheme.colors.grey[700]};
    line-height: 0;
    margin-top: 0.75rem;
    top: 14px;
    right: 4%;
    font-weight: 200;
    transform-origin: center;
    transition: all 200ms linear;
  }
  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 2.4rem;
  }
  details[open] summary {
    opacity: 0.9;
  }
`
const Notification = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  background: #44827e;
  color: #fff;
  line-height: 113%;
  font-size: 15px;
  font-family: ${headingFont};
  border-radius: 50%;
  text-align: center;
  margin-left: 0.5rem;
`

const arr = [{ peerReview: 1 }, { peerReview: 2 }, { peerReview: 3 }]

interface PeerReviewProps {
  id: string
}

const PeerReview: React.FunctionComponent<PeerReviewProps> = ({ id }) => {
  const getPeerReviewReceived = useQuery(`exerciSse-${id}-peer-reviews-received`, () =>
    fetchPeerReviewDataGivenByExerciseId(id),
  )

  if (getPeerReviewReceived.isLoading || getPeerReviewReceived.isIdle) {
    return <Spinner variant={"medium"} />
  }

  if (getPeerReviewReceived.isError) {
    console.log(getPeerReviewReceived.error)
  }

  // WORK ON THE LOOP

  /*   if (
    getPeerReviewReceived.isSuccess &&
    getPeerReviewReceived.data.peer_review_question_submissions.length > 0
  ) {
    const result = getPeerReviewReceived.data.peer_review_questions.map((item) =>
      getPeerReviewReceived.data.peer_review_question_submissions.includes(item.id),
    )
  } */
  return (
    <Wrapper>
      <details>
        <summary>
          {PLACEHOLDER_HEADING}{" "}
          <Notification>
            {getPeerReviewReceived.data?.peer_review_question_submissions.length}
          </Notification>
        </summary>
        {arr?.map((item, index) => (
          <Reviews orderNumber={index} key={index} />
        ))}
      </details>
    </Wrapper>
  )

  // eslint-disable-next-line i18next/no-literal-string
  /* console.log("getPeerReviewReceived", getPeerReviewReceived.data) */
}

export default PeerReview
