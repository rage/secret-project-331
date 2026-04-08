import { queryOptions } from "@tanstack/react-query"

import {
  createCourseChatbotMutation,
  getCourseChatbotsOptions as getCourseChatbotsGeneratedOptions,
  setCourseChatbotAsDefaultMutation,
  setCourseChatbotAsNonDefaultMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createCourseChatbot,
  getCourseChatbots as getCourseChatbotsFromApi,
  setCourseChatbotAsDefault,
  setCourseChatbotAsNonDefault,
} from "@/generated/api/sdk.generated"
import { ChatbotConfiguration } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const getCourseChatbots = async (courseId: string): Promise<Array<ChatbotConfiguration>> => {
  const data = await getCourseChatbotsFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isChatbotConfiguration))
}

export const getCourseChatbotsOptions = (courseId: string) =>
  queryOptions({
    ...getCourseChatbotsGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): ChatbotConfiguration[] =>
      validateGeneratedData(data, isArray(isChatbotConfiguration)),
  })

export const createChatbot = async (
  courseId: string,
  chatbotName: string,
): Promise<ChatbotConfiguration> => {
  const data = await createCourseChatbot({
    body: chatbotName,
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isChatbotConfiguration)
}

export const createChatbotMutationOptions = () => createCourseChatbotMutation()

export const setAsDefaultChatbot = async (
  courseId: string,
  chatbotConfigurationId: string,
): Promise<ChatbotConfiguration> => {
  const data = await setCourseChatbotAsDefault({
    path: {
      chatbot_configuration_id: chatbotConfigurationId,
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isChatbotConfiguration)
}

export const setAsDefaultChatbotMutationOptions = () => setCourseChatbotAsDefaultMutation()

export const setAsNonDefaultChatbot = async (
  courseId: string,
  chatbotConfigurationId: string,
): Promise<ChatbotConfiguration> => {
  const data = await setCourseChatbotAsNonDefault({
    path: {
      chatbot_configuration_id: chatbotConfigurationId,
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isChatbotConfiguration)
}

export const setAsNonDefaultChatbotMutationOptions = () => setCourseChatbotAsNonDefaultMutation()
