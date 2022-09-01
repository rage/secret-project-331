/* eslint-disable i18next/no-literal-string */
import axios from "axios"

interface PendingSubmission {
  id: string
  gradingResultUrl: string
  timestamp: number
}

export const pendingSubmissions: Array<PendingSubmission> = []

export interface ClientErrorResponse {
  message: string
}

export interface GradingResult {
  grading_progress: "FullyGraded" | "Pending" | "PendingManual" | "Failed"
  score_given: number
  score_maximum: number
  feedback_text: string | null
  feedback_json: ExerciseFeedback | null
}

export interface ExerciseFeedback {
  stdout: string
  stderr: string
}

export const updateLms = async () => {
  axios.post("lms", {
    pendingSubmissions: pendingSubmissions,
  })
}
