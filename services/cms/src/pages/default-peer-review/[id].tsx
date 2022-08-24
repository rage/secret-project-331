import { useQuery } from "@tanstack/react-query"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import PeerReviewEditor from "../../components/PeerReviewEditor"
import CourseContext from "../../contexts/CourseContext"
import {
  getCoursesDefaultCmsPeerReviewConfiguration,
  putCoursesDefaultCmsPeerReviewConfiguration,
} from "../../services/backend/courses"
import { CmsPeerReviewConfig, CmsPeerReviewQuestion } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import Spinner from "../../shared-module/components/Spinner"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface PeerReviewManagerProps {
  query: SimplifiedUrlQuery<"id">
}

const PeerReviewManager: React.FC<React.PropsWithChildren<PeerReviewManagerProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState({
    peer_review_config: "",
    peer_review_questions_config: "",
  })
  const { id } = query
  const courseId = useContext(CourseContext)?.courseId

  const getCmsPeerReviewConfiguration = useQuery(
    [`course-${id}-cms-peer-review-configuration`],
    () => getCoursesDefaultCmsPeerReviewConfiguration(id),
    {
      onSuccess: (data) =>
        setAttributes({
          peer_review_config: JSON.stringify(data.peer_review_config),
          peer_review_questions_config: JSON.stringify(data.peer_review_questions),
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
      }),
    {
      notify: true,
      method: "PUT",
    },
    { onSuccess: () => getCmsPeerReviewConfiguration.refetch() },
  )

  if (courseId) {
    return (
      <Layout>
        <div>
          <PeerReviewEditor
            attributes={attributes}
            setAttributes={setAttributes}
            courseId={courseId}
          />
          <Button
            variant="primary"
            size="medium"
            onClick={() => mutateCourseDefaultPeerReview.mutate}
          >
            {t("save")}
          </Button>
        </div>
      </Layout>
    )
  }
  return <Spinner variant="medium" />
}

export default dontRenderUntilQueryParametersReady(PeerReviewManager)
