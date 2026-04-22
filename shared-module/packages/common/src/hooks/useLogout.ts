"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useContext } from "react"
import toast from "react-hot-toast"

import LoginStateContext from "../contexts/LoginStateContext"
import { postAuthLogout } from "../generated/auth-api/sdk.generated"
import "../init/registerAuthApiClients"

/** Performs logout and always refreshes local auth-related client state. */
export default function useLogout() {
  const queryClient = useQueryClient()
  const loginStateContext = useContext(LoginStateContext)

  /** Logs out the current user and keeps client state consistent on failures. */
  const logout = async () => {
    let logoutError: unknown = null
    try {
      await postAuthLogout()
    } catch (error) {
      logoutError = error
    } finally {
      await queryClient.cancelQueries()
      queryClient.removeQueries()
      await loginStateContext.refresh()
      setTimeout(() => {
        queryClient.refetchQueries()
      }, 100)
    }

    if (logoutError) {
      toast.error("Logout failed. Please try again.")
    }
  }

  return { logout }
}
