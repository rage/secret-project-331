import { keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { groupBy } from "lodash"
import * as React from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { fetchPeerReviewDataReceivedByExerciseId } from "../../../../../../services/backend"

import ReceivedPeerOrSelfReview from "./ReceivedPeerOrSelfReview"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const openAnimation = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`

const slideDown = keyframes`
  from { opacity: 0; height: 0; padding: 0;}
  to { opacity: 1; height: 100%; padding: 10px;}
`

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

const PeerOrSelfReviewsReceived: React.FunctionComponent<PeerReviewProps> = ({
  id,
  submissionId,
}) => {
  const { t } = useTranslation()
  const userInfo = useUserInfo()

  const peerOrSelfReviewsReceivedQuery = useQuery({
    queryKey: [`exercise-${id}-exercise-slide-submission-${submissionId}-peer-reviews-received`],
    queryFn: () => fetchPeerReviewDataReceivedByExerciseId(id, submissionId),
  })

  const data = useMemo(() => {
    const ordered =
      peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_question_submissions.sort(
        (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
      )

    const groupByPeerOrSelfReviewSubmissionId = groupBy(
      ordered,
      (review) => review.peer_or_self_review_submission_id,
    )

    let res = Object.values(groupByPeerOrSelfReviewSubmissionId)
    res = res.sort((a, b) => {
      if (a.length === 0) {
        return 1
      }
      if (b.length === 0) {
        return -1
      }
      return parseISO(b[0].created_at).getTime() - parseISO(a[0].created_at).getTime()
    })

    // group by whether the review is self review or peer review
    const res2 = groupBy(res, (questionSubmisssions) => {
      if (questionSubmisssions.length === 0) {
        // eslint-disable-next-line i18next/no-literal-string
        return "peer"
      }
      const peerOrSelfReviewSubmission =
        peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_submissions.find(
          (pr) => pr.id === questionSubmisssions[0].peer_or_self_review_submission_id,
        )
      if (
        peerOrSelfReviewSubmission &&
        peerOrSelfReviewSubmission.user_id === userInfo.data?.user_id
      ) {
        // eslint-disable-next-line i18next/no-literal-string
        return "self"
      }
      // eslint-disable-next-line i18next/no-literal-string
      return "peer"
    })
    return res2
  }, [
    peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_question_submissions,
    peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_submissions,
    userInfo.data?.user_id,
  ])

  if (peerOrSelfReviewsReceivedQuery.isPending) {
    return <Spinner variant={"medium"} />
  }

  if (peerOrSelfReviewsReceivedQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={peerOrSelfReviewsReceivedQuery.error} />
  }

  const numReceivedReviews = (data["peer"]?.length ?? 0) + (data["self"]?.length ?? 0)

  return (
    <Wrapper>
      <details>
        <summary>
          {t("received-reviews")}
          <Notification>{numReceivedReviews}</Notification>
        </summary>

        {(data["self"] ?? []).map((items, index) => {
          return (
            <ReceivedPeerOrSelfReview
              orderNumber={index}
              key={index}
              reviews={items}
              questions={peerOrSelfReviewsReceivedQuery.data.peer_or_self_review_questions}
              selfReview
            />
          )
        })}

        {(data["peer"] ?? []).map((items, index) => {
          return (
            <ReceivedPeerOrSelfReview
              orderNumber={index}
              key={index}
              reviews={items}
              questions={peerOrSelfReviewsReceivedQuery.data.peer_or_self_review_questions}
              selfReview={false}
            />
          )
        })}
      </details>
    </Wrapper>
  )
}

export default PeerOrSelfReviewsReceived
