// Utilities for implementing exercise services

import { UploadResultMessage } from "../exercise-service-protocol-types"
import { uploadFromExerciseService } from "../services/backend/files"

export const EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER = "exercise-service-upload-claim"

export const onUploadFileMessage = async (
  exerciseServiceSlug: string,
  files: Map<string, string | Blob>,
  responsePort: MessagePort,
): Promise<void> => {
  let msg: UploadResultMessage
  try {
    const urls = await uploadFromExerciseService(exerciseServiceSlug, files)
    msg = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "upload-result",
      success: true,
      urls: new Map(Object.entries(urls)),
    }
  } catch (e) {
    msg = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "upload-result",
      success: false,
      error: JSON.stringify(e, null, 2),
    }
  }
  responsePort.postMessage(msg)
}
