import { useSetAtom } from "jotai"
import { useEffect } from "react"

import { defaultChatbotCommunicationChannel } from "@/stores/course-material/chatbotDialogStore"

const useSynchronizeDefaultChatbotCommunicationChannel = (
  isCourseMaterialBlock: boolean,
  mutateAsync: (message: string) => Promise<unknown>,
): void => {
  const setDefaultChatbotCommunicationChannel = useSetAtom(defaultChatbotCommunicationChannel)

  useEffect(() => {
    if (!isCourseMaterialBlock) {
      setDefaultChatbotCommunicationChannel({
        sendNewMessage: async (message) => {
          await mutateAsync(message)
        },
      })
      return () => setDefaultChatbotCommunicationChannel(null)
    }
  }, [isCourseMaterialBlock, setDefaultChatbotCommunicationChannel, mutateAsync])
}

export default useSynchronizeDefaultChatbotCommunicationChannel
