import { useEffect } from "react"

const EditorPage = () => {
  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    console.log("Adding event listener...")
    window.addEventListener("message", handleMessage)
    if (window.parent === window) {
      console.warn(
        "Cannot inform the parent we're ready since there is no parent. Please make sure you're using this from an iframe."
      )
    } else {
      console.log("Telling the parent we're ready")
      window.parent.postMessage({ message: "ready" }, "*")
    }
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  }, [])
  return <>Waiting for content...</>
}

const handleMessage = (event: WindowEventMap["message"]) => {
  // TODO verify event's origin since other sites or tabs can post events
  // as well
  console.log("Frame received an event: ", JSON.stringify(event))
}

export default EditorPage
