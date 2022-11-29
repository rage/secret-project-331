/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import * as fs from "fs"

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

export const downloadStream = async (url: string, target: string) => {
  console.debug("downloading", url, "to", target)
  const templateRes = await axios({
    url,
    method: "GET",
    responseType: "stream",
  })
  const templateWriter = fs.createWriteStream(target)
  templateRes.data.pipe(templateWriter)
  await new Promise((resolve, reject) => {
    templateWriter.on("finish", resolve)
    templateWriter.on("error", reject)
  })
}
