import { Toaster } from "react-hot-toast"

import useMedia from "../../hooks/useMedia"
import { respondToOrLarger } from "../../styles/respond"

const TOAST_BOTTOM_LEFT = "bottom-left"
const TOAST_BOTTOM_CENTER = "bottom-center"

const ToasterNotifications: React.FC<React.PropsWithChildren<unknown>> = () => {
  const notMobile = useMedia(respondToOrLarger.xs)
  return (
    <Toaster
      toastOptions={{ duration: 5000 }}
      position={notMobile ? TOAST_BOTTOM_LEFT : TOAST_BOTTOM_CENTER}
    />
  )
}

export default ToasterNotifications
