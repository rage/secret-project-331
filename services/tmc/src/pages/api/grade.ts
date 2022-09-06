/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import { promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, GradingResult, pendingSubmissions } from "../../lib"
import { GradingRequest } from "../../shared-module/exercise-service-protocol-types-2"
import { extractProject, prepareSubmission } from "../../tmc/langs"

export default async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return await handlePost(req, res)
}

interface Exercise {
  downloadUrl: string
}

interface Submission {
  id: string
  downloadUrl: string
  gradingResultUrl: string
}

type TmcGradingRequest = GradingRequest<Exercise, Submission>

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  // todo: guard
  const gradingRequest: TmcGradingRequest = req.body

  // download submission
  const submissionRes = await axios({
    url: gradingRequest.submission_data.downloadUrl,
    method: "GET",
    responseType: "blob",
  })
  const submissionArchive = temporaryFile()
  await fs.writeFile(submissionArchive, submissionRes.data)

  // extract submission
  const submissionDir = temporaryDirectory()
  extractProject(submissionArchive, submissionDir)

  // download exercise template
  const templateRes = await axios({
    url: gradingRequest.exercise_spec.downloadUrl,
    method: "GET",
    responseType: "blob",
  })
  const templateArchive = temporaryFile()
  await fs.writeFile(templateArchive, templateRes.data)

  // extract template
  const extractedTemplate = temporaryDirectory()
  extractProject(templateArchive, extractedTemplate)

  // prepare submission with tmc-langs
  const preparedSubmissionArchive = temporaryDirectory()
  prepareSubmission(extractedTemplate, preparedSubmissionArchive, submissionDir)

  // send prepared submission to sandbox
  await axios.post("sandbox", {
    file: preparedSubmissionArchive,
  })

  // store pending
  pendingSubmissions.push({
    id: gradingRequest.submission_data.id,
    gradingResultUrl: gradingRequest.submission_data.gradingResultUrl,
    timestamp: Date.now(),
  })

  // send exercise to sandbox
  try {
    return res.status(200).json({
      grading_progress: "Pending",
      score_given: 0,
      score_maximum: 0,
      feedback_text: null,
      feedback_json: null,
    })
  } catch {
    return res.status(500).send({ message: "Internal server error" })
  }
}
