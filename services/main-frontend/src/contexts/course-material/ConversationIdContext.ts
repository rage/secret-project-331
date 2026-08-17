import React from "react"

type ConversationIdContextValue = React.Dispatch<React.SetStateAction<string | null>>

const ConversationIdContext = React.createContext<ConversationIdContextValue | null>(null)

export default ConversationIdContext
