import react from "@vitejs/plugin-react"
import { resolve } from "path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "next/link": resolve(__dirname, "src/mocks/next-link.tsx"),
    },
  },
})
