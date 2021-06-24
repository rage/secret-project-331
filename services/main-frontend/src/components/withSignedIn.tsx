import { useRouter } from "next/router"
import React, { useContext } from "react"

import LoginStateContext from "../contexts/LoginStateContext"

export default function withSignedIn<T>(Component: React.FC<T>): React.FC<T> {
  return (props) => {
    const loginStateContext = useContext(LoginStateContext)
    const router = useRouter()

    if (loginStateContext.isLoading || loginStateContext.signedIn === null) {
      return <div>Loading...</div>
    }

    if (!loginStateContext.signedIn) {
      router.push("/login")
      return <div>Please sign in to view this page.</div>
    }

    // Helper variable to help React resolve displayName and avoid lint error.
    const InnerComponent = <Component {...props} />

    return InnerComponent
  }
}
