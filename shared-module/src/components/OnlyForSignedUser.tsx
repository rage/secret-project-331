import React, { useContext } from "react"

import LoginStateContext from "../contexts/LoginStateContext"

export interface OnlyForSignedUserProps {
  guestMessage?: string
}

const OnlyForSignedUser: React.FC<OnlyForSignedUserProps> = ({ children, guestMessage }) => {
  const loginState = useContext(LoginStateContext)

  if (loginState.isLoading) {
    return <div>Loading... big makkara</div>
  }

  if (!loginState.signedIn) {
    return guestMessage ? <div>{guestMessage}</div> : null
  }

  return <div>{children}</div>
}

export default OnlyForSignedUser
