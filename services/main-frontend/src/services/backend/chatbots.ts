import { queryOptions } from "@tanstack/react-query"

import {
  configureChatbotMutation,
  deleteChatbotConfigurationMutation,
  getChatbotConfigurationOptions as getChatbotConfigurationGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  configureChatbot as configureChatbotFromApi,
  deleteChatbotConfiguration as deleteChatbotConfigurationFromApi,
  getChatbotConfiguration as getChatbotConfigurationFromApi,
} from "@/generated/api/sdk.generated"
import { ChatbotConfiguration, NewChatbotConf } from "@/shared-module/common/bindings"
import { isChatbotConfiguration } from "@/shared-module/common/bindings.guard"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const getChatbotConfiguration = async (
  chatbotConfigurationId: string,
): Promise<ChatbotConfiguration> => {
  const data = await getChatbotConfigurationFromApi({
    path: {
      chatbot_configuration_id: chatbotConfigurationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isChatbotConfiguration)
}

export const getChatbotConfigurationOptions = (chatbotConfigurationId: string) =>
  queryOptions({
    ...getChatbotConfigurationGeneratedOptions({
      path: {
        chatbot_configuration_id: chatbotConfigurationId,
      },
    }),
    select: (data): ChatbotConfiguration => validateGeneratedData(data, isChatbotConfiguration),
  })

export const configureChatbot = async (
  chatbotConfigurationId: string,
  data: NewChatbotConf,
): Promise<ChatbotConfiguration> => {
  const response = await configureChatbotFromApi({
    body: data,
    path: {
      chatbot_configuration_id: chatbotConfigurationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(response, isChatbotConfiguration)
}

export const configureChatbotMutationOptions = () => configureChatbotMutation()

export const deleteChatbot = async (chatbotConfigurationId: string): Promise<void> => {
  await deleteChatbotConfigurationFromApi({
    path: {
      chatbot_configuration_id: chatbotConfigurationId,
    },
    throwOnError: true,
  })
}

export const deleteChatbotMutationOptions = () => deleteChatbotConfigurationMutation()
