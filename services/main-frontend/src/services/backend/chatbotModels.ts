import { queryOptions } from "@tanstack/react-query"

import { getChatbotModelsOptions as getChatbotModelsGeneratedOptions } from "@/generated/api/@tanstack/react-query.generated"
import { getChatbotModels as getChatbotModelsFromApi } from "@/generated/api/sdk.generated"
import { ChatbotConfigurationModel, CourseInfo } from "@/shared-module/common/bindings"
import { isChatbotConfigurationModel } from "@/shared-module/common/bindings.guard"
import { isArray } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const getChatbotModels = async (
  courseId: string,
): Promise<Array<ChatbotConfigurationModel>> => {
  const query: CourseInfo = { course_id: courseId }
  const data = await getChatbotModelsFromApi({
    query,
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isChatbotConfigurationModel))
}

export const getChatbotModelsOptions = (courseId: string) =>
  queryOptions({
    ...getChatbotModelsGeneratedOptions({
      query: {
        course_id: courseId,
      },
    }),
    select: (data): ChatbotConfigurationModel[] =>
      validateGeneratedData(data, isArray(isChatbotConfigurationModel)),
  })
