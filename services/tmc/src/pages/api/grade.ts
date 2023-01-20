/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import { promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"
import { v4 } from "uuid"

import { ClientErrorResponse, downloadStream, GradingResult, pendingSubmissions } from "../../lib"
import { GradingRequest } from "../../shared-module/exercise-service-protocol-types-2"
import { Compression } from "../../tmc/generated"
import { compressProject, extractProject, prepareSubmission } from "../../tmc/langs"
import { PrivateSpec, Submission } from "../../util/stateInterfaces"

export default async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return await handlePost(req, res)
}

type TmcGradingRequest = GradingRequest<PrivateSpec, Submission>

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): Promise<void> => {
  const { exercise_spec, submission_data } = req.body as TmcGradingRequest

  const submissionArchive = temporaryFile()
  let compression: Compression
  let naive: boolean
  if (exercise_spec.type === "editor" && submission_data.type === "editor") {
    // download submission
    const archiveDownloadUrl = submission_data.archiveDownloadUrl
    await downloadStream(archiveDownloadUrl, submissionArchive)
    // todo: support other compression methods?
    compression = "zstd"
    naive = false
  } else if (exercise_spec.type === "browser" && submission_data.type === "browser") {
    // write submission files
    const submissionDir = temporaryDirectory()
    for (const { filepath, contents } of submission_data.files) {
      const resolved = path.resolve(submissionDir, filepath)
      console.log("making", path.dirname(resolved))
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      console.log("writing", resolved)
      await fs.writeFile(resolved, contents)
    }
    await compressProject(submissionDir, submissionArchive, "tar", true)
    compression = "tar"
    naive = true
  } else {
    throw "unexpected submission type"
  }

  // download exercise template
  const templateArchive = temporaryFile()
  await downloadStream(exercise_spec.repositoryExercise.download_url, templateArchive)

  // extract template
  const extractedTemplate = temporaryDirectory()
  await extractProject(templateArchive, extractedTemplate)
  // prepare submission with tmc-langs
  const preparedSubmissionArchive = temporaryFile()
  await prepareSubmission(
    extractedTemplate,
    preparedSubmissionArchive,
    submissionArchive,
    compression,
    naive,
  )
  console.log("prepared submission")

  // TODO: send prepared submission to sandbox
  return res.status(200).json({
    grading_progress: "PendingManual",
    score_given: 0,
    score_maximum: 0,
    feedback_text: null,
    feedback_json: null,
  })

  const id = v4()
  await axios.post("sandbox", {
    id,
    file: preparedSubmissionArchive,
  })

  // store pending
  pendingSubmissions.push({
    id,
    gradingResultUrl: "todo",
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
