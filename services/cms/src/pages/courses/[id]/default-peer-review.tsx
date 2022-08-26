import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../components/Layout"
import PeerReviewEditor from "../../../components/PeerReviewEditor"
import {
  getCoursesDefaultCmsPeerReviewConfiguration,
  putCoursesDefaultCmsPeerReviewConfiguration,
} from "../../../services/backend/courses"
import {
  CmsPeerReviewConfig,
  CmsPeerReviewConfiguration,
  CmsPeerReviewQuestion,
} from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface PeerReviewManagerProps {
  // courseId
  query: SimplifiedUrlQuery<"id">
}

const PeerReviewManager: React.FC<React.PropsWithChildren<PeerReviewManagerProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState({
    peer_review_config: "{}",
    peer_review_questions_config: "[]",
    needs_peer_review: true,
    use_course_default_peer_review: false,
  })

  const { id } = query

  const getCmsPeerReviewConfiguration = useQuery(
    [`course-${id}-cms-peer-review-configuration`],
    () => getCoursesDefaultCmsPeerReviewConfiguration(id),
    {
      onSuccess: (data) =>
        setAttributes({
          peer_review_config: JSON.stringify(data.peer_review_config),
          peer_review_questions_config: JSON.stringify(data.peer_review_questions),
          needs_peer_review: true,
          use_course_default_peer_review: false,
        }),
    },
  )
  const mutateCourseDefaultPeerReview = useToastMutation(
    () =>
      putCoursesDefaultCmsPeerReviewConfiguration(id, {
        peer_review_config: JSON.parse(attributes.peer_review_config) as CmsPeerReviewConfig,
        peer_review_questions: JSON.parse(
          attributes.peer_review_questions_config,
        ) as CmsPeerReviewQuestion[],
      } as CmsPeerReviewConfiguration),
    {
      notify: true,
      method: "PUT",
      errorMessage: "",
      successMessage: "",
    },
    { onSuccess: () => getCmsPeerReviewConfiguration.refetch() },
  )

  if (getCmsPeerReviewConfiguration.isError) {
    return <ErrorBanner error={getCmsPeerReviewConfiguration.error} variant="text" />
  }

  if (getCmsPeerReviewConfiguration.isLoading) {
    return <Spinner variant="medium" />
  }

  return (
    <Layout>
      <PeerReviewEditor
        attributes={attributes}
        setAttributes={setAttributes}
        courseId={getCmsPeerReviewConfiguration.data.peer_review_config.course_id}
        courseGlobalEditor={true}
      />
      <Button
        variant="primary"
        size="medium"
        onClick={() => mutateCourseDefaultPeerReview.mutate()}
      >
        {t("save")}
      </Button>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(PeerReviewManager)
