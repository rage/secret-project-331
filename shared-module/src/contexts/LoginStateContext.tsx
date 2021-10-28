import React, { ComponentType, useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Spinner from "../components/Spinner"
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
  // eslint-disable-next-line i18next/no-literal-string
  const displayName = Component.displayName || Component.name || "Component"

  const InnerComponent: React.FC<T> = (props) => {
    const { t } = useTranslation()
    const loginStateContext = useContext(LoginStateContext)

    if (loginStateContext.isLoading || loginStateContext.signedIn === null) {
      return <Spinner variant="medium" />
    }

    if (!loginStateContext.signedIn) {
      const returnTo = encodeURIComponent(window.location.pathname)
      // eslint-disable-next-line i18next/no-literal-string
      window.location.replace(`/login?return_to=${returnTo}`)
      return <div>{t("please-sign-in-to-view-this-page")}</div>
    }

    return <Component {...props} />
  }

  // eslint-disable-next-line i18next/no-literal-string
  InnerComponent.displayName = `withSignedIn(${displayName})`
  return InnerComponent
}
