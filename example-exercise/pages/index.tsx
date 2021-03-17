import { useEffect } from "react"
import styled from "styled-components"

const Title = styled.h1`
  font-size: 24px;
`

const Iframe = styled.iframe`
  width: 100%;
  // To see the size of the frame in development
  border: 1px solid black;
`

export default function Home() {
  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    console.log("Adding event listener...")
    window.addEventListener("message", handleMessage)
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  }, [])
  return (
    <>
      <Title>Iframe test page</Title>
      <Iframe src="/editor" frameBorder="off" />
    </>
  )
}

const handleMessage = (event: WindowEventMap["message"]) => {
  // TODO verify event's origin since other sites or tabs can post events
  // as well
  console.log("Parent received an event: ", JSON.stringify(event.data))
}
