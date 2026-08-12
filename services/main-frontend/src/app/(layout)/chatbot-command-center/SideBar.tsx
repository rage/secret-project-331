"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"

import { allUserConversationsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { Button, QueryResult } from "@/shared-module/components"

const SideBar = ({ configurationId }: { configurationId: string }) => {
  const conversationsQuery = useQuery(
    allUserConversationsOptions({
      path: {
        chatbot_configuration_id: configurationId,
      },
    }),
  )

  return (
    <QueryResult query={conversationsQuery}>
      {(conversations) =>
        conversations.map((conversation) => (
          <div key={conversation.id}>
            <Button size="small" variant="tertiary" onClick={() => console.log(conversation.id)}>
              {conversation.id}
            </Button>
          </div>
        ))
      }
    </QueryResult>
  )
}

export default SideBar
