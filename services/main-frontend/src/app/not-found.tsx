"use client"

import Layout from "@/components/Layout"

import NotFoundContent from "./(layout)/NotFoundContent"

// Unmatched URLs render outside the (layout) group, so the site chrome is added here.
export default function RootNotFound() {
  return (
    <Layout>
      <NotFoundContent />
    </Layout>
  )
}
