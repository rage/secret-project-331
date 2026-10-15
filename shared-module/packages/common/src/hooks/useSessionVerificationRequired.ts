"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import LoginStateContext from "../contexts/LoginStateContext"
import { getAuthSessionStatusOptions } from "../generated/auth-api/@tanstack/react-query.generated"
import "../init/registerAuthApiClients"

/** Whether the signed-in session must confirm its owner before the user can continue. */
export default function useSessionVerificationRequired(): boolean {
  const { signedIn } = useContext(LoginStateContext)
  const sessionStatus = useQuery({
    ...getAuthSessionStatusOptions(),
    enabled: signedIn === true,
    // Lets other tabs drop their dialog after one tab verifies.
    refetchOnWindowFocus: true,
  })
  return signedIn === true && sessionStatus.data?.verification_required === true
}
