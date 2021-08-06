import { Feedback } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchFeedback = async (courseId: string): Promise<Array<Feedback>> => {
  const response = await mainFrontendClient.get(`/courses/${courseId}/feedback`, {
    responseType: "json",
  })
  return response.data
}

export const sendFeedback = async (data: Feedback): Promise<string> => {
  const response = await mainFrontendClient.post("/feedback", data, {
    headers: { "Content-Type": "application/json" },
  })
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
