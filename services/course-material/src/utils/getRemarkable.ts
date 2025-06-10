import { Remarkable } from "remarkable"

let md: Remarkable | null = null

export const getRemarkable = () => {
  if (md === null) {
    md = new Remarkable()
  }
  return md
}
