import { createContext } from "react"

const MessagePortContext = createContext<MessagePort | null>(null)

export default MessagePortContext
