"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import type {
  ChatbotConversation,
  ChatbotConversationInfo,
} from "@/generated/course-material-api/types.generated"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { waitForNextTick } from "@/shared-module/common/utils/async"
import {
  defaultChatbotCommunicationChannel,
  defaultChatbotIsTurnInFlightAtom,
} from "@/stores/course-material/chatbotDialogStore"

import ChatbotDisclaimer from "../ChatbotDisclaimer"
import type { ChatbotAction } from "../chatbotReducer"

/// Sets a communication channel so that components outside ChatbotDialog can send
/// messages to the default chatbot of the course.
const useSynchronizeDefaultChatbotCommunicationChannel = (
  isCourseMaterialBlock: boolean,
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>,
  mutateNewMessageAsync: (message: string) => Promise<unknown>,
  mutateNewConversationAsync: () => Promise<ChatbotConversation>,
  dispatch: (a: ChatbotAction) => void,
  isTurnInFlight: boolean,
): void => {
  const { t } = useTranslation()
  const setDefaultChatbotCommunicationChannel = useSetAtom(defaultChatbotCommunicationChannel)
  const setDefaultChatbotIsTurnInFlight = useSetAtom(defaultChatbotIsTurnInFlightAtom)
  const { confirm } = useDialog()

  // Fields, not the result object: React Query returns a fresh one per render, which would rebuild
  // the channel on every streamed token.
  const currentConversation = currentConversationInfo.data?.current_conversation
  const refetchConversationInfo = currentConversationInfo.refetch

  useEffect(() => {
    if (isCourseMaterialBlock) {
      return undefined
    }
    setDefaultChatbotCommunicationChannel({
      sendNewMessage: async (message) => {
        if (!currentConversation) {
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
          dispatch({ type: "RESPONSE_COMPLETED" })
          await refetchConversationInfo()
        }
        // waiting for refetch
        await waitForNextTick()
        await mutateNewMessageAsync(message)
      },
    })
    return () => setDefaultChatbotCommunicationChannel(null)
  }, [
    isCourseMaterialBlock,
    currentConversation,
    refetchConversationInfo,
    setDefaultChatbotCommunicationChannel,
    mutateNewMessageAsync,
    confirm,
    mutateNewConversationAsync,
    dispatch,
    t,
  ])

  useEffect(() => {
    if (isCourseMaterialBlock) {
      return undefined
    }
    setDefaultChatbotIsTurnInFlight(isTurnInFlight)
    return () => setDefaultChatbotIsTurnInFlight(false)
  }, [isCourseMaterialBlock, isTurnInFlight, setDefaultChatbotIsTurnInFlight])
}

export default useSynchronizeDefaultChatbotCommunicationChannel
