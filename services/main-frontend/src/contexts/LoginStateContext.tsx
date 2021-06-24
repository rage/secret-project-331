import React, { useEffect, useState } from "react"
import { useQuery } from "react-query"
import { loggedIn } from "../services/backend/auth"

export interface LoginState {
  refresh(): void
  isLoading: boolean
  signedIn: boolean | null
}

const defaultLoginState: LoginState = {
  refresh: () => {
    /* No op */
  },
  isLoading: false,
  signedIn: null,
}

const LoginStateContext = React.createContext<LoginState>(defaultLoginState)

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

export default LoginStateContext
