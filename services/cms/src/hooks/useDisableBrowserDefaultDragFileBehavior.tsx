import { useEffect } from "react"

const useDisableBrowserDefaultDragFileBehavior = () => {
  useEffect(() => {
    const callback = (e: Event) => {
      e.preventDefault()
    }
    window.addEventListener("drop", callback)
    window.addEventListener("dragover", callback)
    return () => {
      window.removeEventListener("drop", callback)
      window.removeEventListener("dragover", callback)
    }
  }, [])
}

export default useDisableBrowserDefaultDragFileBehavior
