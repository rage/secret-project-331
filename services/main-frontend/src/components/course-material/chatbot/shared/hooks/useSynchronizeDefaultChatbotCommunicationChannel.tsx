"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import type {
  ChatbotConversation,
  ChatbotConversationInfo,
} from "@/generated/course-material-api/types.generated"
import { waitForNextTick } from "@/shared-module/common/utils/async"
import { useDialog } from "@/shared-module/components"
import {
  defaultChatbotCommunicationChannel,
  defaultChatbotIsTurnInFlight,
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
  const setDefaultChatbotIsTurnInFlight = useSetAtom(defaultChatbotIsTurnInFlight)
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
        try {
          if (!currentConversation) {
            const confirmed = await confirm({
              message: <ChatbotDisclaimer hideHeader={true} />,
              title: t("about-the-chatbot"),
              confirmLabel: t("button-text-agree"),
              cancelLabel: t("button-text-cancel"),
            })
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
        } catch {
          // The mutation's own onError surfaces the failure, and a send started while a turn is
          // already running is refused there too.
        }
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

  // Own effect so unmounting resets the value once, instead of every value-setting run also
  // tearing it down and letting the next run's set-up re-emit it: that turned every turn start
  // into two announcements (false, then true) to every subscriber.
  useEffect(() => {
    if (isCourseMaterialBlock) {
      return undefined
    }
    return () => setDefaultChatbotIsTurnInFlight(false)
  }, [isCourseMaterialBlock, setDefaultChatbotIsTurnInFlight])

  useEffect(() => {
    if (isCourseMaterialBlock) {
      return
    }
    setDefaultChatbotIsTurnInFlight(isTurnInFlight)
  }, [isCourseMaterialBlock, isTurnInFlight, setDefaultChatbotIsTurnInFlight])
}

export default useSynchronizeDefaultChatbotCommunicationChannel
