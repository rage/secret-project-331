import React from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import SubmissionIFrame from "../../components/SubmissionIFrame"
import { fetchExerciseServiceInfo } from "../../services/backend/exerciseServiceInfo"
import { fetchExerciseService } from "../../services/backend/exerciseServices"
import { fetchExerciseTask } from "../../services/backend/exerciseTasks"
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
    isLoading: isExerciseLoading,
    error: exerciseError,
    data: exerciseData,
  } = useQuery([`exercise-for-submission-${id}`, id], () => fetchExercise(exerciseId), {
    enabled: !!exerciseId,
  })

  const exerciseTaskId = submissionData?.exercise_task_id
  const {
    isLoading: isExerciseTaskLoading,
    error: exerciseTaskError,
    data: exerciseTaskData,
  } = useQuery(
    [`exercise-task-for-submission-${id}`, id],
    () => fetchExerciseTask(exerciseTaskId),
    {
      enabled: !!exerciseTaskId,
    },
  )

  const gradingId = submissionData?.grading_id
  const {
    isLoading: gradingLoading,
    error: gradingError,
    data: gradingData,
  } = useQuery([`grading-for-submission-${id}`, id], () => fetchGrading(gradingId), {
    enabled: !!gradingId,
  })

  const exerciseType = exerciseTaskData?.exercise_type
  const {
    isLoading: isExerciseServiceLoading,
    error: exerciseServiceError,
    data: exerciseServiceData,
  } = useQuery(
    [`exercise-service-for-submission-${id}`, id],
    () => fetchExerciseService(exerciseType),
    {
      enabled: !!exerciseType,
    },
  )

  const {
    isLoading: isExerciseServiceInfoLoading,
    error: exerciseServiceInfoError,
    data: exerciseServiceInfoData,
  } = useQuery(
    [`exercise-service-info-for-submission-${id}`, id],
    () => fetchExerciseServiceInfo(exerciseServiceData.public_url), // todo internal url
    {
      enabled: !!exerciseServiceData,
    },
  )

  if (submissionError) {
    return <pre>{JSON.stringify(submissionError, undefined, 2)}</pre>
  }

  if (
    isSubmissionLoading ||
    !submissionData ||
    isExerciseLoading ||
    !exerciseTaskData ||
    isExerciseServiceLoading ||
    !exerciseServiceData ||
    isExerciseServiceInfoLoading ||
    !exerciseServiceInfoData
  ) {
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
      <SubmissionIFrame
        url={`${exerciseServiceInfoData.submission_iframe_path}?width=700`} // todo: move constants to shared module?
        public_spec={exerciseTaskData.public_spec}
        submission={submissionData}
      />
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
