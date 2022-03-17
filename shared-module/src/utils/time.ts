/* eslint-disable i18next/no-literal-string */
import { format } from "date-fns"

export const dateToString = (date: Date, timeZone = true): string => {
  try {
    const datePart = `${format(date, "yyyy-MM-dd HH:mm:ss")}`
    const timeZonePart = ` UTC${format(date, `xxx`)}`
    return datePart + (timeZone ? timeZonePart : "")
  } catch (e) {
    return "Invalid date"
  }
}

export const dateToDateTimeLocalString = (date: Date): string => {
  try {
    return `${format(date, "yyyy-MM-dd")}T${format(date, "HH:mm:ss")}`
  } catch (e) {
    return "Invalid date"
  }
}
