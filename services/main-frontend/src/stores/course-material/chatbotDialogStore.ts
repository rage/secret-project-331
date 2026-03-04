import { atom } from "jotai"

export const chatbotOpenAtom = atom<boolean>(false)

const _chatbotNewMessageAtom = atom<string>("")
