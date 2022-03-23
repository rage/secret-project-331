/* eslint-disable i18next/no-literal-string */
import axios from "axios"

import { ActionOnResource } from "../../bindings"

export const loggedIn = async (): Promise<boolean> => {
  const url = `/api/v0/auth/logged-in`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const login = async (email: string, password: string): Promise<void> => {
  const url = `/api/v0/auth/login`
  await axios.post(url, {
    email,
    password,
  })
}

export const logout = async (): Promise<void> => {
  const url = `/api/v0/auth/logout`
  await axios.post(url)
}

export const authorize = async (action: ActionOnResource): Promise<boolean> => {
  return (await axios.post("/api/v0/auth/authorize", action)).data
}
