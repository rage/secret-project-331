import { useQuery } from "@tanstack/react-query"
import React, { ComponentType, useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "../components/ErrorBanner"
import Spinner from "../components/Spinner"
import { loggedIn } from "../services/backend/auth"

export interface LoginState {
  isPending: boolean
  refresh(): Promise<unknown>
  signedIn: boolean | null | undefined
}

const defaultLoginState: LoginState = {
  isPending: false,
  refresh: async () => {
    /* No op */
  },
  signedIn: null,
}

const LoginStateContext = React.createContext<LoginState>(defaultLoginState)

export default LoginStateContext

export const LoginStateContextProvider: React.FC<React.PropsWithChildren<unknown>> = ({
  children,
}) => {
  const [loginState, setLoginState] = useState(defaultLoginState)
  const isLoggedIn = useQuery({ queryKey: [`logged-in`], queryFn: loggedIn })

  useEffect(() => {
    setLoginState((prev) => ({
      ...prev,
      isPending: isLoggedIn.isPending,
      refresh: isLoggedIn.refetch,
      signedIn: isLoggedIn.data,
    }))
  }, [isLoggedIn.data, isLoggedIn.isPending, isLoggedIn.refetch])

  if (isLoggedIn.isError) {
    return <ErrorBanner variant={"readOnly"} error={isLoggedIn.error} />
  }

  return <LoginStateContext.Provider value={loginState}>{children}</LoginStateContext.Provider>
}

export function withSignedIn<T>(
  Component: ComponentType<React.PropsWithChildren<T>>,
): React.FC<React.PropsWithChildren<T>> {
  const displayName = Component.displayName || Component.name || "Component"

  const InnerComponent: React.FC<React.PropsWithChildren<T>> = (props) => {
    const { t } = useTranslation()
    const loginStateContext = useContext(LoginStateContext)

    if (loginStateContext.isPending || loginStateContext.signedIn === null) {
      return <Spinner variant="medium" />
    }

    if (!loginStateContext.signedIn) {
      const returnTo = encodeURIComponent(window.location.pathname)

      window.location.replace(`/login?return_to=${returnTo}`)
      return <div>{t("please-sign-in-to-view-this-page")}</div>
    }

    // @ts-ignore: Shared module might have a diffrerent react version
    return <Component {...props} />
  }

  InnerComponent.displayName = `withSignedIn(${displayName})`
  return InnerComponent
}
mponent {...props} />
  }

  InnerComponent.displayName = `withSignedIn(${displayName})`
  return InnerComponent
}
