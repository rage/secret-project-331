"use client"

import { UseQueryResult } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import ChatbotAgree from "../ChatbotAgree"

import { MessageAction } from "./useChatbotStateAndData"

import { ChatbotConversation, ChatbotConversationInfo } from "@/shared-module/common/bindings"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { waitForNextTick } from "@/shared-module/common/utils/async"
import { defaultChatbotCommunicationChannel } from "@/stores/course-material/chatbotDialogStore"

const useSynchronizeDefaultChatbotCommunicationChannel = (
  isCourseMaterialBlock: boolean,
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>,
  mutateNewMessageAsync: (message: string) => Promise<unknown>,
  mutateNewConversationAsync: () => Promise<ChatbotConversation>,
  dispatch: (a: MessageAction) => void,
): void => {
  const { t } = useTranslation()
  const setDefaultChatbotCommunicationChannel = useSetAtom(defaultChatbotCommunicationChannel)
  const { confirm } = useDialog()

  useEffect(() => {
    if (!isCourseMaterialBlock) {
      setDefaultChatbotCommunicationChannel({
        sendNewMessage: async (message) => {
          if (!currentConversationInfo.data?.current_conversation) {
            const confirmed = await confirm(
              <ChatbotAgree header={""} />,
              t("about-the-chatbot"),
              {},
            )
            if (!confirmed) {
              return
            }
            await mutateNewConversationAsync()
            dispatch({ type: "RESET_MESSAGES" })
            await currentConversationInfo.refetch()
          }
          // waiting for refetch
          await waitForNextTick()
          await mutateNewMessageAsync(message)
        },
      })
      return () => setDefaultChatbotCommunicationChannel(null)
    }
  }, [
    isCourseMaterialBlock,
    currentConversationInfo,
    setDefaultChatbotCommunicationChannel,
    mutateNewMessageAsync,
    confirm,
    mutateNewConversationAsync,
    dispatch,
    t,
  ])
}

export default useSynchronizeDefaultChatbotCommunicationChannel
