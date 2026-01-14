"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { ComponentType, useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "../components/ErrorBanner"
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

export const LoginStateContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loginState, setLoginState] = useState(defaultLoginState)
  const isLoggedIn = useQuery({ queryKey: [`logged-in`], queryFn: loggedIn })

  useEffect(() => {
    setLoginState((prev) => ({
      ...prev,
      isLoading: isLoggedIn.isLoading,
      refresh: isLoggedIn.refetch,
      signedIn: isLoggedIn.data,
    }))
  }, [isLoggedIn.data, isLoggedIn.isLoading, isLoggedIn.refetch])

  if (isLoggedIn.isError) {
    return <ErrorBanner variant={"readOnly"} error={isLoggedIn.error} />
  }

  return <LoginStateContext.Provider value={loginState}>{children}</LoginStateContext.Provider>
}

const DEFAULT_DISPLAY_NAME = "Component"

export function withSignedIn<T>(Component: ComponentType<T>): React.FC<T> {
  const displayName = Component.displayName || Component.name || DEFAULT_DISPLAY_NAME

  const InnerComponent: React.FC<T> = (props) => {
    const { t } = useTranslation()
    const router = useRouter()
    const loginStateContext = useContext(LoginStateContext)

    useEffect(() => {
      if (!loginStateContext.isLoading && loginStateContext.signedIn === false) {
        const returnTo = encodeURIComponent(
          window.location.pathname + window.location.search + window.location.hash,
        )
        // eslint-disable-next-line i18next/no-literal-string
        router.replace(`/login?return_to=${returnTo}`)
      }
    }, [loginStateContext.isLoading, loginStateContext.signedIn, router])

    if (loginStateContext.isLoading || loginStateContext.signedIn === null) {
      return <Spinner variant="medium" />
    }

    if (!loginStateContext.signedIn) {
      return <div>{t("please-sign-in-to-view-this-page")}</div>
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Shared module might have a diffrerent react version
    return <Component {...props} />
  }

  InnerComponent.displayName = `withSignedIn(${displayName})`
  return InnerComponent
}
