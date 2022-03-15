import { useEffect, useState } from "react"
const TOP_BAR_HEIGHT_PX = 90
const useSidebarStartingYCoodrinate = () => {
  const [pos, setPos] = useState<number>(TOP_BAR_HEIGHT_PX)
  useEffect(() => {
    setPos(calculateNewPosition())
    const callback = () => {
      setPos(calculateNewPosition())
    }
    window.addEventListener("scroll", callback)
    return () => {
      window.removeEventListener("scroll", callback)
    }
  }, [])

  return pos
}

function calculateNewPosition(): number {
  const scrollY = window.scrollY
  if (scrollY >= TOP_BAR_HEIGHT_PX) {
    return 0
  } else {
    return TOP_BAR_HEIGHT_PX - scrollY
  }
}

export default useSidebarStartingYCoodrinate
