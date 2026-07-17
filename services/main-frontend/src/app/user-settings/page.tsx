"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

const UserSettingsPage: React.FC = () => {
  const router = useRouter()
  useEffect(() => {
    // oxlint-disable-next-line i18next/no-literal-string
    router.replace("/user-settings/account")
  }, [router])
  return null
}

export default UserSettingsPage
