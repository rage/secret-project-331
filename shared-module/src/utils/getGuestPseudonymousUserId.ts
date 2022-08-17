import { v4 } from "uuid"

const KEY = "guestRandomUserIdForExerciseService"

// Returns a random id for the guest users so that the exercise services can work without authentication.
const getGuestPseudonymousUserId = (): string => {
  if (typeof window === "undefined") {
    return v4()
  }
  const randomId = localStorage.getItem(KEY)
  if (!randomId) {
    const newRandomId = v4()
    localStorage.setItem(KEY, newRandomId)
    return newRandomId
  }
  return randomId
}

export default getGuestPseudonymousUserId
