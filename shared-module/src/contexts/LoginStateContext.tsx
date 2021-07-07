import React, { ComponentType, useContext, useEffect, useState } from "react"
import { useQuery } from "react-query"

import { loggedIn } from "../services/backend/auth"

export interface LoginState {
  isLoading: boolean
  refresh(): Promise<unknown>
  signedIn: boolean | null | undefined
}

const defaultLoginState: LoginState = {
  isLoading: false,
  refresh: async () => {
    /* No op */
  },
  signedIn: null,
}

const LoginStateContext = React.createContext<LoginState>(defaultLoginState)

export default LoginStateContext

export const LoginStateContextProvider: React.FC = ({ children }) => {
  const [loginState, setLoginState] = useState(defaultLoginState)
  const { isLoading, error, data, refetch } = useQuery(`logged-in`, loggedIn)

  useEffect(() => {
    setLoginState((prev) => ({
      ...prev,
      isLoading,
      refresh: refetch,
      signedIn: data,
    }))
  }, [data, isLoading, refetch])

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  return <LoginStateContext.Provider value={loginState}>{children}</LoginStateContext.Provider>
}

export function withSignedIn<T>(Component: ComponentType<T>): React.FC<T> {
  const displayName = Component.displayName || Component.name || "Component"

  const InnerComponent: React.FC<T> = (props) => {
    const loginStateContext = useContext(LoginStateContext)

    if (loginStateContext.isLoading || loginStateContext.signedIn === null) {
      return <div>Loading...</div>
    }

    if (!loginStateContext.signedIn) {
      const returnTo = encodeURIComponent(window.location.pathname)
      window.location.replace(`/login?return_to=${returnTo}`)
      return <div>Please sign in to view this page.</div>
    }

    return <Component {...props} />
  }

  InnerComponent.displayName = `withSignedIn(${displayName})`
  return InnerComponent
}
