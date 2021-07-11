import React from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import { fetchExercise } from "../../services/backend/exercises"
import { fetchGrading } from "../../services/backend/gradings"
import { fetchSubmission } from "../../services/backend/submissions"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"

const Submission: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const {
    isLoading: isSubmissionLoading,
    error: submissionError,
    data: submissionData,
  } = useQuery(`submission-${id}`, () => fetchSubmission(id))

  const exerciseId = submissionData?.exercise_id
  const {
    isLoading: exerciseLoading,
    error: exerciseError,
    data: exerciseData,
  } = useQuery([`exercise-for-submission-${id}`, id], () => fetchExercise(exerciseId), {
    enabled: !!exerciseId,
  })

  const gradingId = submissionData?.grading_id
  const {
    isLoading: gradingLoading,
    error: gradingError,
    data: gradingData,
  } = useQuery([`grading-for-submission-${id}`, id], () => fetchGrading(gradingId), {
    enabled: !!gradingId,
  })

  if (submissionError) {
    return <pre>{JSON.stringify(submissionError, undefined, 2)}</pre>
  }

  if (isSubmissionLoading || !submissionData) {
    return <>Loading...</>
  }

  let grading = <></>
  if (exerciseData && gradingData) {
    grading = (
      <div>
        <div>
          Points: {gradingData.score_given} out of {exerciseData.score_maximum}
        </div>
        <div>
          Submitted at {submissionData.created_at.toDateString()} by {submissionData.user_id}
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <h1>Submission {submissionData.id}</h1>
      {grading}
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
