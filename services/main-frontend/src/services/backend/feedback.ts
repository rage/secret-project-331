import { queryOptions } from "@tanstack/react-query"

import {
  getCourseFeedbackCountOptions as getCourseFeedbackCountGeneratedOptions,
  getCourseFeedbackOptions as getCourseFeedbackGeneratedOptions,
  markFeedbackAsReadMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getCourseFeedback,
  getCourseFeedbackCount,
  markFeedbackAsRead,
} from "@/generated/api/sdk.generated"
import {
  Feedback,
  FeedbackCount,
  GetFeedbackQuery,
  MarkAsRead,
} from "@/shared-module/common/bindings"
import { isFeedback, isFeedbackCount } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchFeedback = async (
  courseId: string,
  read: boolean,
  page?: number,
  limit?: number,
): Promise<Array<Feedback>> => {
  const params: GetFeedbackQuery = { read, page: undefined, limit: undefined }
  params.page = page
  params.limit = limit

  const data = await getCourseFeedback({
    path: {
      course_id: courseId,
    },
    query: params,
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isFeedback))
}

export const fetchFeedbackCount = async (courseId: string): Promise<FeedbackCount> => {
  const data = await getCourseFeedbackCount({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isFeedbackCount)
}

export const getFeedbackOptions = (
  courseId: string,
  read: boolean,
  page?: number,
  limit?: number,
) => {
  const query: GetFeedbackQuery = { read, page: undefined, limit: undefined }
  query.page = page
  query.limit = limit

  return queryOptions({
    ...getCourseFeedbackGeneratedOptions({
      path: {
        course_id: courseId,
      },
      query,
    }),
    select: (data): Feedback[] => validateGeneratedData(data, isArray(isFeedback)),
  })
}

export const getFeedbackCountOptions = (courseId: string) =>
  queryOptions({
    ...getCourseFeedbackCountGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): FeedbackCount => validateGeneratedData(data, isFeedbackCount),
  })

export const getUnreadFeedbackCountOptions = (courseId: string) =>
  queryOptions({
    ...getCourseFeedbackCountGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): number => validateGeneratedData(data, isFeedbackCount).unread,
  })

export const markAsRead = async (feedbackId: string, read: boolean): Promise<void> => {
  const data: MarkAsRead = {
    read,
  }

  await markFeedbackAsRead({
    body: data,
    path: {
      feedback_id: feedbackId,
    },
    throwOnError: true,
  })
}

export const markAsReadMutationOptions = () => markFeedbackAsReadMutation()
