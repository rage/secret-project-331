import Link from "next/link"
import { useRouter } from "next/router"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import LoginStateContext from "../shared-module/contexts/LoginStateContext"
import { logout } from "../shared-module/services/backend/auth"

export default function LoginLogoutButton(): JSX.Element {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const router = useRouter()

  if (loginStateContext.isLoading) {
    return <>Loading...</>
  }

  if (loginStateContext.signedIn) {
    const submitLogout = async (event) => {
      event.preventDefault()
      await logout()
      await loginStateContext.refresh()
    }
    return (
      <form onSubmit={submitLogout}>
        <button name="logout" type="submit">
          {t("logout")}
        </button>
      </form>
    )
  } else {
    return <Link href={`/login?return_to=${encodeURIComponent(router.asPath)}`}>Login</Link>
  }
}
