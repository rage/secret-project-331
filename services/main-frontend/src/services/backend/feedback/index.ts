import { Feedback, FeedbackCount, GetFeedbackQuery } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchFeedback = async (
  courseId: string,
  read: boolean,
  page?: number,
  limit?: number,
): Promise<Feedback[]> => {
  const params: GetFeedbackQuery = { read }
  params.page = page
  params.limit = limit

  const response = await mainFrontendClient.get(`/courses/${courseId}/feedback`, {
    params,
    responseType: "json",
  })
  return response.data
}

export const fetchFeedbackCount = async (courseId: string): Promise<FeedbackCount> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/feedback-count`)
  return response.data
}

export const markAsRead = async (feedbackId: string, read: boolean): Promise<void> => {
  const data = {
    read: read,
  }
  await mainFrontendClient.post(`/feedback/${feedbackId}`, data, {
    headers: { "Content-Type": "application/json" },
  })
}
