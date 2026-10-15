"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { groupBy } from "lodash"
import * as React from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { fetchPeerReviewDataReceivedByExerciseIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { PeerOrSelfReviewsReceived as PeerOrSelfReviewsReceivedData } from "@/generated/course-material-api/types.generated"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { Button, Disclosure, QueryResult, ErrorNotice } from "@/shared-module/components"

import ReceivedPeerOrSelfReview from "./ReceivedPeerOrSelfReview"

const Notification = styled.span`
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
    ...fetchPeerReviewDataReceivedByExerciseIdOptions({
      path: {
        exercise_id: id,
        exercise_slide_submission_id: submissionId,
      },
    }),
    select: (data): PeerOrSelfReviewsReceivedData => data,
  })

  const data = useMemo(() => {
    const ordered =
      peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_question_submissions.toSorted(
        (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
      )

    const groupByPeerOrSelfReviewSubmissionId = groupBy(
      ordered,
      (review) => review.peer_or_self_review_submission_id,
    )

    let res = Object.values(groupByPeerOrSelfReviewSubmissionId)
    res = res.toSorted((a, b) => {
      if (a.length === 0) {
        return 1
      }
      if (b.length === 0) {
        return -1
      }
      // a and b are non-empty (length === 0 handled above), so these are always defined.
      const aFirst = a[0]
      const bFirst = b[0]
      if (aFirst === undefined || bFirst === undefined) {
        return 0
      }
      return parseISO(bFirst.created_at).getTime() - parseISO(aFirst.created_at).getTime()
    })

    // group by whether the review is self review or peer review
    const res2 = groupBy(res, (questionSubmisssions) => {
      if (questionSubmisssions.length === 0) {
        // oxlint-disable-next-line i18next/no-literal-string
        return "peer"
      }
      const peerOrSelfReviewSubmission =
        peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_submissions.find(
          // questionSubmisssions is non-empty (length === 0 handled above).
          (pr) => pr.id === questionSubmisssions[0]?.peer_or_self_review_submission_id,
        )
      if (
        peerOrSelfReviewSubmission &&
        peerOrSelfReviewSubmission.user_id === userInfo.data?.user_id
      ) {
        // oxlint-disable-next-line i18next/no-literal-string
        return "self"
      }
      // oxlint-disable-next-line i18next/no-literal-string
      return "peer"
    })
    return res2
  }, [
    peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_question_submissions,
    peerOrSelfReviewsReceivedQuery.data?.peer_or_self_review_submissions,
    userInfo.data?.user_id,
  ])

  const numReceivedReviews = (data["peer"]?.length ?? 0) + (data["self"]?.length ?? 0)

  return (
    <QueryResult
      query={peerOrSelfReviewsReceivedQuery}
      treatNullAsEmpty
      emptyFallback={
        <div>
          <ErrorNotice error={t("error-loading-exercise")} />
          <Button
            variant={"primary"}
            size={"medium"}
            onClick={() => {
              void peerOrSelfReviewsReceivedQuery.refetch()
            }}
          >
            {t("button-text-try-again")}
          </Button>
        </div>
      }
    >
      {(queryData) => (
        <Disclosure
          title={
            <>
              {t("received-reviews")}
              <Notification>{numReceivedReviews}</Notification>
            </>
          }
        >
          {(data["self"] ?? []).map((items, index) => {
            return (
              <ReceivedPeerOrSelfReview
                orderNumber={index}
                key={index}
                reviews={items}
                questions={queryData.peer_or_self_review_questions}
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
                questions={queryData.peer_or_self_review_questions}
                selfReview={false}
              />
            )
          })}
        </Disclosure>
      )}
    </QueryResult>
  )
}

export default PeerOrSelfReviewsReceived
