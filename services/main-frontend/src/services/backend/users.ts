import { User } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchUser = async (id: string): Promise<User> => {
  const response = await mainFrontendClient.get(`/users/${id}`)
  return response.data
}
