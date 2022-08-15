import { useQuery } from "@tanstack/react-query"
import { useContext, useState } from "react"

import PeerReviewEditor from "../../components/PeerReviewEditor"
import CourseContext from "../../contexts/CourseContext"
import { getCoursesDefaultCmsPeerReviewConfiguration } from "../../services/backend/courses"
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
  if (getCmsPeerReviewConfiguration.data && courseId) {
    return (
      <PeerReviewEditor attributes={attributes} setAttributes={setAttributes} courseId={courseId} />
    )
  }
}

export default PeerReviewManager
