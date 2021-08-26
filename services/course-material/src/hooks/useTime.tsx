import { useEffect, useState } from "react"

export default function useTime(refreshCycle = 1000): Date {
  const [now, setNow] = useState(getTime())

  useEffect(() => {
    const intervalId = setInterval(() => setNow(getTime()), refreshCycle)

    return () => clearInterval(intervalId)
  }, [refreshCycle, setNow])

  return now
}

const getTime = () => {
  return new Date()
}
