import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["@react-aria/dialog"],
  },
  ssr: {
    noExternal: ["@react-aria/dialog"],
  },
})
