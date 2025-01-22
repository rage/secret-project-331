import { createContext, useContext } from "react"

interface ImageInteractivityContextType {
  disableInteractivity?: boolean
}

export const ImageInteractivityContext = createContext<ImageInteractivityContextType>({
  disableInteractivity: false,
})

export const useImageInteractivity = () => useContext(ImageInteractivityContext)
