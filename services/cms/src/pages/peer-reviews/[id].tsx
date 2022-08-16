import { faN } from "@fortawesome/free-solid-svg-icons"
import { useQuery } from "@tanstack/react-query"
import { useContext, useState } from "react"

import PeerReviewEditor from "../../components/PeerReviewEditor"
import CourseContext from "../../contexts/CourseContext"
import {
  getCoursesDefaultCmsPeerReviewConfiguration,
  putCoursesDefaultCmsPeerReviewConfiguration,
} from "../../services/backend/courses"
import { CmsPeerReview, CmsPeerReviewQuestion } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import { SimplifiedUrlQuery } from "../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface PeerReviewManagerProps {
  query: SimplifiedUrlQuery<"id">
}

const PeerReviewManager = ({ query }: PeerReviewManagerProps) => {
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
          peer_review_config: JSON.stringify(data.peer_review),
          peer_review_questions_config: JSON.stringify(data.peer_review_questions),
        }),
    },
  )
  const mutateCourseDefaultPeerReview = useToastMutation(
    () =>
      putCoursesDefaultCmsPeerReviewConfiguration(id, {
        peer_review: JSON.parse(attributes.peer_review_config) as CmsPeerReview,
        peer_review_questions: JSON.parse(
          attributes.peer_review_questions_config,
        ) as CmsPeerReviewQuestion[],
      }),
    {
      notify: true,
      method: "PUT",
      successMessage: "",
    },
    { onSuccess: () => getCmsPeerReviewConfiguration.refetch() },
  )
  if (getCmsPeerReviewConfiguration.data && courseId) {
    return (
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
        ></Button>
      </div>
    )
  }
}

export default PeerReviewManager
