"use client"

import { UseQueryResult } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import ChatbotDisclaimer from "../ChatbotDisclaimer"

import { MessageAction } from "./useChatbotStateAndData"

import { ChatbotConversation, ChatbotConversationInfo } from "@/shared-module/common/bindings"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { waitForNextTick } from "@/shared-module/common/utils/async"
import { defaultChatbotCommunicationChannel } from "@/stores/course-material/chatbotDialogStore"

/// Sets a communication channel so that components outside ChatbotDialog can send
/// messages to the default chatbot of the course.
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
              <ChatbotDisclaimer hideHeader={true} />,
              t("about-the-chatbot"),
              {
                yesButtonLabel: t("button-text-agree"),
                noButtonLabel: t("button-text-cancel"),
              },
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
