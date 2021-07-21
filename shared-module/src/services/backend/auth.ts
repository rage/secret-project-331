import axios from "axios"

export const loggedIn = async (): Promise<boolean> => {
  const url = `/api/v0/auth/logged-in`
  const data = (await axios.get(url, { responseType: "json" })).data
  return data
}

export const login = async (email: string, password: string): Promise<boolean> => {
  const url = `/api/v0/auth/login`
  try {
    await axios.post(url, {
      email,
      password,
    })
    return true
  } catch (e) {
    console.log("failed to login: ", e)
    return false
  }
}

export const logout = async (): Promise<void> => {
  const url = `/api/v0/auth/logout`
  await axios.post(url)
}
