import { ReactNode } from "react"

class DialogService {
  alert: ((message: ReactNode, title?: string) => Promise<void>) | null = null
  confirm: ((message: ReactNode, title?: string) => Promise<boolean>) | null = null
  prompt:
    | ((message: ReactNode, title?: string, defaultValue?: string) => Promise<string | null>)
    | null = null

  register({
    alert,
    confirm,
    prompt,
  }: {
    alert: (message: ReactNode, title?: string) => Promise<void>
    confirm: (message: ReactNode, title?: string) => Promise<boolean>
    prompt: (message: ReactNode, title?: string, defaultValue?: string) => Promise<string | null>
  }) {
    this.alert = alert
    this.confirm = confirm
    this.prompt = prompt
  }
}

const dialogService = new DialogService()
export default dialogService
