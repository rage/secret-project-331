import React, { useContext } from "react"
import { logout } from "../services/backend/auth"
import Link from "next/link"
import LoginStateContext from "../contexts/LoginStateContext"

export default function LoginLogoutButton(): JSX.Element {
  const loginStateContext = useContext(LoginStateContext)

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
        <button type="submit">Logout</button>
      </form>
    )
  } else {
    return <Link href="/login">Login</Link>
  }
}
