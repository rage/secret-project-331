import { keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { groupBy } from "lodash"
import * as React from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { fetchPeerReviewDataReceivedByExerciseId } from "../../../../../../services/backend"
import ErrorBanner from "../../../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/common/components/Spinner"
import { baseTheme, headingFont } from "../../../../../../shared-module/common/styles"

import ReceivedPeerReview from "./ReceivedPeerReview"

const openAnimation = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`

const slideDown = keyframes`
  from { opacity: 0; height: 0; padding: 0;}
  to { opacity: 1; height: 100%; padding: 10px;}
`

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  details {
    transition: all 0.3s ease-in-out;
  }

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.gray[700]};
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
    color: ${baseTheme.colors.gray[700]};
    outline: 0;
    background: ${baseTheme.colors.clear[100]};
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: ${baseTheme.colors.gray[700]};
  }

  details summary:after {
    content: "+";
    position: absolute;
    font-size: 2.4rem;
    color: ${baseTheme.colors.gray[700]};
    line-height: 0;
    margin-top: 0.75rem;
    top: 18px;
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
  width: 22px;
  height: 22px;
  background: #44827e;
  color: #fff;
  line-height: 112%;
  font-size: 15px;
  font-family: ${headingFont};
  border-radius: 50%;
  text-align: center;
  margin-left: 0.5rem;
  border: 1px solid ${baseTheme.colors.green[100]};
`

interface PeerReviewProps {
  id: string
  submissionId: string
}

const PeerReviewsReceived: React.FunctionComponent<PeerReviewProps> = ({ id, submissionId }) => {
  const { t } = useTranslation()

  const getPeerReviewReceived = useQuery({
    queryKey: [`exercise-${id}-exercise-slide-submission-${submissionId}-peer-reviews-received`],
    queryFn: () => fetchPeerReviewDataReceivedByExerciseId(id, submissionId),
  })

  const data = useMemo(() => {
    const ordered = getPeerReviewReceived.data?.peer_review_question_submissions.sort(
      (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
    )

    const groupByPeerReviewSubmissionId = groupBy(
      ordered,
      (review) => review.peer_review_submission_id,
    )

    let res = Object.values(groupByPeerReviewSubmissionId)
    res = res.sort((a, b) => {
      if (a.length === 0) {
        return 1
      }
      if (b.length === 0) {
        return -1
      }
      return parseISO(b[0].created_at).getTime() - parseISO(a[0].created_at).getTime()
    })
    return res
  }, [getPeerReviewReceived.data?.peer_review_question_submissions])

  if (getPeerReviewReceived.isPending) {
    return <Spinner variant={"medium"} />
  }

  if (getPeerReviewReceived.isError) {
    return <ErrorBanner error={getPeerReviewReceived.error} />
  }

  return (
    <Wrapper>
      <details>
        <summary>
          {t("peer-reviews-received-from-other-students")}
          <Notification>{data.length ?? "0"}</Notification>
        </summary>
        {data.map((item, index) => (
          <ReceivedPeerReview
            orderNumber={index}
            key={index}
            review={item}
            questions={getPeerReviewReceived.data.peer_review_questions}
          />
        ))}
      </details>
    </Wrapper>
  )
}

export default PeerReviewsReceived
