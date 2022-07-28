import { Feedback, FeedbackCount, GetFeedbackQuery, MarkAsRead } from "../../shared-module/bindings"
import { isFeedback, isFeedbackCount } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchFeedback = async (
  courseId: string,
  read: boolean,
  page?: number,
  limit?: number,
): Promise<Array<Feedback>> => {
  const params: GetFeedbackQuery = { read, page: undefined, limit: undefined }
  params.page = page
  params.limit = limit

  const response = await mainFrontendClient.get(`/courses/${courseId}/feedback`, {
    params,
    responseType: "json",
  })
  return validateResponse(response, isArray(isFeedback))
}

export const fetchFeedbackCount = async (courseId: string): Promise<FeedbackCount> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/feedback-count`)
  return validateResponse(response, isFeedbackCount)
}

export const markAsRead = async (feedbackId: string, read: boolean): Promise<void> => {
  const data: MarkAsRead = {
    read: read,
  }
  await mainFrontendClient.post(`/feedback/${feedbackId}`, data, {
    headers: { "Content-Type": "application/json" },
  })
}
