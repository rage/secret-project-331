import { ReactNode } from "react"

class DialogService {
  alert: ((title: string, message?: ReactNode) => Promise<void>) | null = null
  confirm: ((title: string, message?: ReactNode) => Promise<boolean>) | null = null
  prompt:
    | ((title: string, message?: ReactNode, defaultValue?: string) => Promise<string | null>)
    | null = null

  register({
    alert,
    confirm,
    prompt,
  }: {
    alert: (title: string, message?: ReactNode) => Promise<void>
    confirm: (title: string, message?: ReactNode) => Promise<boolean>
    prompt: (title: string, message?: ReactNode, defaultValue?: string) => Promise<string | null>
  }) {
    this.alert = alert
    this.confirm = confirm
    this.prompt = prompt
  }
}

const dialogService = new DialogService()
export default dialogService
