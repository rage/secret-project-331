// Utilities for implementing exercise services

import { UploadResultMessage } from "../exercise-service-protocol-types"
import { uploadFromExerciseService } from "../services/backend/files"

export const EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER = "exercise-service-upload-claim"

export const onUploadFileMessage = async (
  exerciseServiceSlug: string,
  data: unknown,
  responsePort: MessagePort,
): Promise<void> => {
  let msg: UploadResultMessage
  try {
    const url = await uploadFromExerciseService(exerciseServiceSlug, data)
    msg = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "upload-result",
      success: true,
      url,
    }
  } catch (e) {
    msg = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "upload-result",
      success: false,
      error: JSON.stringify(e, null, 2),
    }
    responsePort.postMessage(msg)
  }
}
