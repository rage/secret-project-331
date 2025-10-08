#!/usr/bin/env python3
"""
migrate_app_router.py

- Rewrites files under Next.js `app/` to App Router conventions using Azure OpenAI.
- Optionally scaffolds required special files (layout.tsx, not-found.tsx, error.tsx).
- Supports model-proposed multi-file output via a JSON "manifest".
- Dry-run by default (prints unified diffs). Use --write to apply.
- You can narrow the scope with --include/--exclude globs.

Env:
  AZURE_API_HOST   = your-resource-name.openai.azure.com (no protocol)
  AZURE_API_MODEL  = your deployment name (e.g. gpt-4o)
  AZURE_API_KEY    = your key

Examples:
  python3 migrate_app_router.py --root services/main-frontend/src/app --scaffold --include '**/page.tsx'
  python3 migrate_app_router.py --root services/main-frontend/src/app --scaffold --include '**/page.tsx' --exclude '**/components/**' --write
"""

import argparse
import difflib
import fnmatch
import hashlib
import http.client
import json
import logging
import os
import sys
import time
from typing import Dict, Any, Iterable, List, Tuple

API_VERSION = "2024-06-01"

# ---------------- Docs Context ----------------
NEXT_DOCS = """
# How to migrate from Pages to the App Router

## Next Steps

* [Upgrade new features](#upgrading-new-features): A guide to help you upgrade to new features such as the improved Image and Link Components.
* [Migrate from the `pages` to `app` directory](#migrating-from-pages-to-app): A step-by-step guide to help you incrementally migrate from the `pages` to the `app` directory.

## Upgrading New Features

Next.js 13 introduced the new [App Router](/docs/app.md) with new features and conventions. The new Router is available in the `app` directory and co-exists with the `pages` directory.

Upgrading to Next.js 13 does **not** require using the App Router. You can continue using `pages` with new features that work in both directories, such as the updated [Image component](#image-component), [Link component](#link-component), [Script component](#script-component), and [Font optimization](#font-optimization).

### `<Image/>` Component

Next.js 12 introduced new improvements to the Image Component with a temporary import: `next/future/image`. These improvements included less client-side JavaScript, easier ways to extend and style images, better accessibility, and native browser lazy loading.

In version 13, this new behavior is now the default for `next/image`.

There are two codemods to help you migrate to the new Image Component:

* [**`next-image-to-legacy-image` codemod**](/docs/app/guides/upgrading/codemods.md#next-image-to-legacy-image): Safely and automatically renames `next/image` imports to `next/legacy/image`. Existing components will maintain the same behavior.
* [**`next-image-experimental` codemod**](/docs/app/guides/upgrading/codemods.md#next-image-experimental): Dangerously adds inline styles and removes unused props. This will change the behavior of existing components to match the new defaults. To use this codemod, you need to run the `next-image-to-legacy-image` codemod first.

### `<Link>` Component

The [`<Link>` Component](/docs/app/api-reference/components/link.md) no longer requires manually adding an `<a>` tag as a child. This behavior was added as an experimental option in [version 12.2](https://nextjs.org/blog/next-12-2) and is now the default. In Next.js 13, `<Link>` always renders `<a>` and allows you to forward props to the underlying tag.

For example:

```jsx
import Link from 'next/link'

// Next.js 12: `<a>` has to be nested otherwise it's excluded
<Link href="/about">
  <a>About</a>
</Link>

// Next.js 13: `<Link>` always renders `<a>` under the hood
<Link href="/about">
  About
</Link>
```

To upgrade your links to Next.js 13, you can use the [`new-link` codemod](/docs/app/guides/upgrading/codemods.md#new-link).

### `<Script>` Component

The behavior of [`next/script`](/docs/app/api-reference/components/script.md) has been updated to support both `pages` and `app`, but some changes need to be made to ensure a smooth migration:

* Move any `beforeInteractive` scripts you previously included in `_document.js` to the root layout file (`app/layout.tsx`).
* The experimental `worker` strategy does not yet work in `app` and scripts denoted with this strategy will either have to be removed or modified to use a different strategy (e.g. `lazyOnload`).
* `onLoad`, `onReady`, and `onError` handlers will not work in Server Components so make sure to move them to a [Client Component](/docs/app/getting-started/server-and-client-components.md) or remove them altogether.

### Font Optimization

Previously, Next.js helped you optimize fonts by [inlining font CSS](/docs/app/api-reference/components/font.md). Version 13 introduces the new [`next/font`](/docs/app/api-reference/components/font.md) module which gives you the ability to customize your font loading experience while still ensuring great performance and privacy. `next/font` is supported in both the `pages` and `app` directories.

While [inlining CSS](/docs/app/api-reference/components/font.md) still works in `pages`, it does not work in `app`. You should use [`next/font`](/docs/app/api-reference/components/font.md) instead.

See the [Font Optimization](/docs/app/api-reference/components/font.md) page to learn how to use `next/font`.

## Migrating from `pages` to `app`

> **🎥 Watch:** Learn how to incrementally adopt the App Router → [YouTube (16 minutes)](https://www.youtube.com/watch?v=YQMSietiFm0).

Moving to the App Router may be the first time using React features that Next.js builds on top of such as Server Components, Suspense, and more. When combined with new Next.js features such as [special files](/docs/app/api-reference/file-conventions.md) and [layouts](/docs/app/api-reference/file-conventions/layout.md), migration means new concepts, mental models, and behavioral changes to learn.

We recommend reducing the combined complexity of these updates by breaking down your migration into smaller steps. The `app` directory is intentionally designed to work simultaneously with the `pages` directory to allow for incremental page-by-page migration.

* The `app` directory supports nested routes *and* layouts. [Learn more](/docs/app/getting-started/layouts-and-pages.md).
* Use nested folders to define routes and a special `page.js` file to make a route segment publicly accessible. [Learn more](#step-4-migrating-pages).
* [Special file conventions](/docs/app/api-reference/file-conventions.md) are used to create UI for each route segment. The most common special files are `page.js` and `layout.js`.
  * Use `page.js` to define UI unique to a route.
  * Use `layout.js` to define UI that is shared across multiple routes.
  * `.js`, `.jsx`, or `.tsx` file extensions can be used for special files.
* You can colocate other files inside the `app` directory such as components, styles, tests, and more. [Learn more](/docs/app.md).
* Data fetching functions like `getServerSideProps` and `getStaticProps` have been replaced with [a new API](/docs/app/getting-started/fetching-data.md) inside `app`. `getStaticPaths` has been replaced with [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params.md).
* `pages/_app.js` and `pages/_document.js` have been replaced with a single `app/layout.js` root layout. [Learn more](/docs/app/api-reference/file-conventions/layout.md#root-layout).
* `pages/_error.js` has been replaced with more granular `error.js` special files. [Learn more](/docs/app/getting-started/error-handling.md).
* `pages/404.js` has been replaced with the [`not-found.js`](/docs/app/api-reference/file-conventions/not-found.md) file.
* `pages/api/*` API Routes have been replaced with the [`route.js`](/docs/app/api-reference/file-conventions/route.md) (Route Handler) special file.

### Step 1: Creating the `app` directory

Update to the latest Next.js version (requires 13.4 or greater):

```bash
npm install next@latest
```

Then, create a new `app` directory at the root of your project (or `src/` directory).

### Step 2: Creating a Root Layout

Create a new `app/layout.tsx` file inside the `app` directory. This is a [root layout](/docs/app/api-reference/file-conventions/layout.md#root-layout) that will apply to all routes inside `app`.

```tsx filename="app/layout.tsx" switcher
export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```jsx filename="app/layout.js" switcher
export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

* The `app` directory **must** include a root layout.
* The root layout must define `<html>`, and `<body>` tags since Next.js does not automatically create them
* The root layout replaces the `pages/_app.tsx` and `pages/_document.tsx` files.
* `.js`, `.jsx`, or `.tsx` extensions can be used for layout files.

To manage `<head>` HTML elements, you can use the [built-in SEO support](/docs/app/getting-started/metadata-and-og-images.md):

```tsx filename="app/layout.tsx" switcher
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Welcome to Next.js',
}
```

```jsx filename="app/layout.js" switcher
export const metadata = {
  title: 'Home',
  description: 'Welcome to Next.js',
}
```

#### Migrating `_document.js` and `_app.js`

If you have an existing `_app` or `_document` file, you can copy the contents (e.g. global styles) to the root layout (`app/layout.tsx`). Styles in `app/layout.tsx` will *not* apply to `pages/*`. You should keep `_app`/`_document` while migrating to prevent your `pages/*` routes from breaking. Once fully migrated, you can then safely delete them.

If you are using any React Context providers, they will need to be moved to a [Client Component](/docs/app/getting-started/server-and-client-components.md).

#### Migrating the `getLayout()` pattern to Layouts (Optional)

Next.js recommended adding a [property to Page components](/docs/pages/building-your-application/routing/pages-and-layouts.md#layout-pattern) to achieve per-page layouts in the `pages` directory. This pattern can be replaced with native support for [nested layouts](/docs/app/api-reference/file-conventions/layout.md) in the `app` directory.

<details>
<summary>See before and after example</summary>

**Before**

```jsx filename="components/DashboardLayout.js"
export default function DashboardLayout({ children }) {
  return (
    <div>
      <h2>My Dashboard</h2>
      {children}
    </div>
  )
}
```

```jsx filename="pages/dashboard/index.js"
import DashboardLayout from '../components/DashboardLayout'

export default function Page() {
  return <p>My Page</p>
}

Page.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>
}
```

**After**

* Remove the `Page.getLayout` property from `pages/dashboard/index.js` and follow the [steps for migrating pages](#step-4-migrating-pages) to the `app` directory.

  ```jsx filename="app/dashboard/page.js"
  export default function Page() {
    return <p>My Page</p>
  }
  ```

* Move the contents of `DashboardLayout` into a new [Client Component](/docs/app/getting-started/server-and-client-components.md) to retain `pages` directory behavior.

  ```jsx filename="app/dashboard/DashboardLayout.js"
  'use client' // this directive should be at top of the file, before any imports.

  // This is a Client Component
  export default function DashboardLayout({ children }) {
    return (
      <div>
        <h2>My Dashboard</h2>
        {children}
      </div>
    )
  }
  ```

* Import the `DashboardLayout` into a new `layout.js` file inside the `app` directory.

  ```jsx filename="app/dashboard/layout.js"
  import DashboardLayout from './DashboardLayout'

  // This is a Server Component
  export default function Layout({ children }) {
    return <DashboardLayout>{children}</DashboardLayout>
  }
  ```

* You can incrementally move non-interactive parts of `DashboardLayout.js` (Client Component) into `layout.js` (Server Component) to reduce the amount of component JavaScript you send to the client.

</details>

### Step 3: Migrating `next/head`

In the `pages` directory, the `next/head` React component is used to manage `<head>` HTML elements such as `title` and `meta` . In the `app` directory, `next/head` is replaced with the new [built-in SEO support](/docs/app/getting-started/metadata-and-og-images.md).

**Before:**

```tsx filename="pages/index.tsx" switcher
import Head from 'next/head'

export default function Page() {
  return (
    <>
      <Head>
        <title>My page title</title>
      </Head>
    </>
  )
}
```

```jsx filename="pages/index.js" switcher
import Head from 'next/head'

export default function Page() {
  return (
    <>
      <Head>
        <title>My page title</title>
      </Head>
    </>
  )
}
```

**After:**

```tsx filename="app/page.tsx" switcher
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Page Title',
}

export default function Page() {
  return '...'
}
```

```jsx filename="app/page.js" switcher
export const metadata = {
  title: 'My Page Title',
}

export default function Page() {
  return '...'
}
```

[See all metadata options](/docs/app/api-reference/functions/generate-metadata.md).

### Step 4: Migrating Pages

* Pages in the [`app` directory](/docs/app.md) are [Server Components](/docs/app/getting-started/server-and-client-components.md) by default. This is different from the `pages` directory where pages are [Client Components](/docs/app/getting-started/server-and-client-components.md).
* [Data fetching](/docs/app/getting-started/fetching-data.md) has changed in `app`. `getServerSideProps`, `getStaticProps` and `getInitialProps` have been replaced with a simpler API.
* The `app` directory uses nested folders to define routes and a special `page.js` file to make a route segment publicly accessible.
* | `pages` Directory | `app` Directory       | Route          |
  | ----------------- | --------------------- | -------------- |
  | `index.js`        | `page.js`             | `/`            |
  | `about.js`        | `about/page.js`       | `/about`       |
  | `blog/[slug].js`  | `blog/[slug]/page.js` | `/blog/post-1` |

We recommend breaking down the migration of a page into two main steps:

* Step 1: Move the default exported Page Component into a new Client Component.
* Step 2: Import the new Client Component into a new `page.js` file inside the `app` directory.

> **Good to know**: This is the easiest migration path because it has the most comparable behavior to the `pages` directory.

**Step 1: Create a new Client Component**

* Create a new separate file inside the `app` directory (i.e. `app/home-page.tsx` or similar) that exports a Client Component. To define Client Components, add the `'use client'` directive to the top of the file (before any imports).
  * Similar to the Pages Router, there is an [optimization step](/docs/app/getting-started/server-and-client-components.md#on-the-client-first-load) to prerender Client Components to static HTML on the initial page load.
* Move the default exported page component from `pages/index.js` to `app/home-page.tsx`.

```tsx filename="app/home-page.tsx" switcher
'use client'

// This is a Client Component (same as components in the `pages` directory)
// It receives data as props, has access to state and effects, and is
// prerendered on the server during the initial page load.
export default function HomePage({ recentPosts }) {
  return (
    <div>
      {recentPosts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

```jsx filename="app/home-page.js" switcher
'use client'

// This is a Client Component. It receives data as props and
// has access to state and effects just like Page components
// in the `pages` directory.
export default function HomePage({ recentPosts }) {
  return (
    <div>
      {recentPosts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

**Step 2: Create a new page**

* Create a new `app/page.tsx` file inside the `app` directory. This is a Server Component by default.

* Import the `home-page.tsx` Client Component into the page.

* If you were fetching data in `pages/index.js`, move the data fetching logic directly into the Server Component using the new [data fetching APIs](/docs/app/getting-started/fetching-data.md). See the [data fetching upgrade guide](#step-6-migrating-data-fetching-methods) for more details.

  ```tsx filename="app/page.tsx" switcher
  // Import your Client Component
  import HomePage from './home-page'

  async function getPosts() {
    const res = await fetch('https://...')
    const posts = await res.json()
    return posts
  }

  export default async function Page() {
    // Fetch data directly in a Server Component
    const recentPosts = await getPosts()
    // Forward fetched data to your Client Component
    return <HomePage recentPosts={recentPosts} />
  }
  ```

  ```jsx filename="app/page.js" switcher
  // Import your Client Component
  import HomePage from './home-page'

  async function getPosts() {
    const res = await fetch('https://...')
    const posts = await res.json()
    return posts
  }

  export default async function Page() {
    // Fetch data directly in a Server Component
    const recentPosts = await getPosts()
    // Forward fetched data to your Client Component
    return <HomePage recentPosts={recentPosts} />
  }
  ```

* If your previous page used `useRouter`, you'll need to update to the new routing hooks. [Learn more](/docs/app/api-reference/functions/use-router.md).

* Start your development server and visit [`http://localhost:3000`](http://localhost:3000). You should see your existing index route, now served through the app directory.

### Step 5: Migrating Routing Hooks

A new router has been added to support the new behavior in the `app` directory.

In `app`, you should use the three new hooks imported from `next/navigation`: [`useRouter()`](/docs/app/api-reference/functions/use-router.md), [`usePathname()`](/docs/app/api-reference/functions/use-pathname.md), and [`useSearchParams()`](/docs/app/api-reference/functions/use-search-params.md).

* The new `useRouter` hook is imported from `next/navigation` and has different behavior to the `useRouter` hook in `pages` which is imported from `next/router`.
  * The [`useRouter` hook imported from `next/router`](/docs/pages/api-reference/functions/use-router.md) is not supported in the `app` directory but can continue to be used in the `pages` directory.
* The new `useRouter` does not return the `pathname` string. Use the separate `usePathname` hook instead.
* The new `useRouter` does not return the `query` object. Search parameters and dynamic route parameters are now separate. Use the `useSearchParams` and `useParams` hooks instead.
* You can use `useSearchParams` and `usePathname` together to listen to page changes. See the [Router Events](/docs/app/api-reference/functions/use-router.md#router-events) section for more details.
* These new hooks are only supported in Client Components. They cannot be used in Server Components.

```tsx filename="app/example-client-component.tsx" switcher
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function ExampleClientComponent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ...
}
```

```jsx filename="app/example-client-component.js" switcher
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function ExampleClientComponent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ...
}
```

In addition, the new `useRouter` hook has the following changes:

* `isFallback` has been removed because `fallback` has [been replaced](#replacing-fallback).
* The `locale`, `locales`, `defaultLocales`, `domainLocales` values have been removed because built-in i18n Next.js features are no longer necessary in the `app` directory. [Learn more about i18n](/docs/app/guides/internationalization.md).
* `basePath` has been removed. The alternative will not be part of `useRouter`. It has not yet been implemented.
* `asPath` has been removed because the concept of `as` has been removed from the new router.
* `isReady` has been removed because it is no longer necessary. During [static rendering](/docs/app/getting-started/partial-prerendering.md#static-rendering), any component that uses the [`useSearchParams()`](/docs/app/api-reference/functions/use-search-params.md) hook will skip the prerendering step and instead be rendered on the client at runtime.
* `route` has been removed. `usePathname` or `useSelectedLayoutSegments()` provide an alternative.

[View the `useRouter()` API reference](/docs/app/api-reference/functions/use-router.md).

#### Sharing components between `pages` and `app`

To keep components compatible between the `pages` and `app` routers, refer to the [`useRouter` hook from `next/compat/router`](/docs/pages/api-reference/functions/use-router.md#the-nextcompatrouter-export).
This is the `useRouter` hook from the `pages` directory, but intended to be used while sharing components between routers. Once you are ready to use it only on the `app` router, update to the new [`useRouter` from `next/navigation`](/docs/app/api-reference/functions/use-router.md).

### Step 6: Migrating Data Fetching Methods

The `pages` directory uses `getServerSideProps` and `getStaticProps` to fetch data for pages. Inside the `app` directory, these previous data fetching functions are replaced with a [simpler API](/docs/app/getting-started/fetching-data.md) built on top of `fetch()` and `async` React Server Components.

```tsx filename="app/page.tsx" switcher
export default async function Page() {
  // This request should be cached until manually invalidated.
  // Similar to `getStaticProps`.
  // `force-cache` is the default and can be omitted.
  const staticData = await fetch(`https://...`, { cache: 'force-cache' })

  // This request should be refetched on every request.
  // Similar to `getServerSideProps`.
  const dynamicData = await fetch(`https://...`, { cache: 'no-store' })

  // This request should be cached with a lifetime of 10 seconds.
  // Similar to `getStaticProps` with the `revalidate` option.
  const revalidatedData = await fetch(`https://...`, {
    next: { revalidate: 10 },
  })

  return <div>...</div>
}
```

```jsx filename="app/page.js" switcher
export default async function Page() {
  // This request should be cached until manually invalidated.
  // Similar to `getStaticProps`.
  // `force-cache` is the default and can be omitted.
  const staticData = await fetch(`https://...`, { cache: 'force-cache' })

  // This request should be refetched on every request.
  // Similar to `getServerSideProps`.
  const dynamicData = await fetch(`https://...`, { cache: 'no-store' })

  // This request should be cached with a lifetime of 10 seconds.
  // Similar to `getStaticProps` with the `revalidate` option.
  const revalidatedData = await fetch(`https://...`, {
    next: { revalidate: 10 },
  })

  return <div>...</div>
}
```

#### Server-side Rendering (`getServerSideProps`)

In the `pages` directory, `getServerSideProps` is used to fetch data on the server and forward props to the default exported React component in the file. The initial HTML for the page is prerendered from the server, followed by "hydrating" the page in the browser (making it interactive).

```jsx filename="pages/dashboard.js"
// `pages` directory

export async function getServerSideProps() {
  const res = await fetch(`https://...`)
  const projects = await res.json()

  return { props: { projects } }
}

export default function Dashboard({ projects }) {
  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  )
}
```

In the App Router, we can colocate our data fetching inside our React components using [Server Components](/docs/app/getting-started/server-and-client-components.md). This allows us to send less JavaScript to the client, while maintaining the rendered HTML from the server.

By setting the `cache` option to `no-store`, we can indicate that the fetched data should [never be cached](/docs/app/getting-started/fetching-data.md). This is similar to `getServerSideProps` in the `pages` directory.

```tsx filename="app/dashboard/page.tsx" switcher
// `app` directory

// This function can be named anything
async function getProjects() {
  const res = await fetch(`https://...`, { cache: 'no-store' })
  const projects = await res.json()

  return projects
}

export default async function Dashboard() {
  const projects = await getProjects()

  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  )
}
```

```jsx filename="app/dashboard/page.js" switcher
// `app` directory

// This function can be named anything
async function getProjects() {
  const res = await fetch(`https://...`, { cache: 'no-store' })
  const projects = await res.json()

  return projects
}

export default async function Dashboard() {
  const projects = await getProjects()

  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  )
}
```

#### Accessing Request Object

In the `pages` directory, you can retrieve request-based data based on the Node.js HTTP API.

For example, you can retrieve the `req` object from `getServerSideProps` and use it to retrieve the request's cookies and headers.

```jsx filename="pages/index.js"
// `pages` directory

export async function getServerSideProps({ req, query }) {
  const authHeader = req.getHeaders()['authorization'];
  const theme = req.cookies['theme'];

  return { props: { ... }}
}

export default function Page(props) {
  return ...
}
```

The `app` directory exposes new read-only functions to retrieve request data:

* [`headers`](/docs/app/api-reference/functions/headers.md): Based on the Web Headers API, and can be used inside [Server Components](/docs/app/getting-started/server-and-client-components.md) to retrieve request headers.
* [`cookies`](/docs/app/api-reference/functions/cookies.md): Based on the Web Cookies API, and can be used inside [Server Components](/docs/app/getting-started/server-and-client-components.md) to retrieve cookies.

```tsx filename="app/page.tsx" switcher
// `app` directory
import { cookies, headers } from 'next/headers'

async function getData() {
  const authHeader = (await headers()).get('authorization')

  return '...'
}

export default async function Page() {
  // You can use `cookies` or `headers` inside Server Components
  // directly or in your data fetching function
  const theme = (await cookies()).get('theme')
  const data = await getData()
  return '...'
}
```

```jsx filename="app/page.js" switcher
// `app` directory
import { cookies, headers } from 'next/headers'

async function getData() {
  const authHeader = (await headers()).get('authorization')

  return '...'
}

export default async function Page() {
  // You can use `cookies` or `headers` inside Server Components
  // directly or in your data fetching function
  const theme = (await cookies()).get('theme')
  const data = await getData()
  return '...'
}
```

#### Static Site Generation (`getStaticProps`)

In the `pages` directory, the `getStaticProps` function is used to pre-render a page at build time. This function can be used to fetch data from an external API or directly from a database, and pass this data down to the entire page as it's being generated during the build.

```jsx filename="pages/index.js"
// `pages` directory

export async function getStaticProps() {
  const res = await fetch(`https://...`)
  const projects = await res.json()

  return { props: { projects } }
}

export default function Index({ projects }) {
  return projects.map((project) => <div>{project.name}</div>)
}
```

In the `app` directory, data fetching with [`fetch()`](/docs/app/api-reference/functions/fetch.md) will default to `cache: 'force-cache'`, which will cache the request data until manually invalidated. This is similar to `getStaticProps` in the `pages` directory.

```jsx filename="app/page.js"
// `app` directory

// This function can be named anything
async function getProjects() {
  const res = await fetch(`https://...`)
  const projects = await res.json()

  return projects
}

export default async function Index() {
  const projects = await getProjects()

  return projects.map((project) => <div>{project.name}</div>)
}
```

#### Dynamic paths (`getStaticPaths`)

In the `pages` directory, the `getStaticPaths` function is used to define the dynamic paths that should be pre-rendered at build time.

```jsx filename="pages/posts/[id].js"
// `pages` directory
import PostLayout from '@/components/post-layout'

export async function getStaticPaths() {
  return {
    paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
  }
}

export async function getStaticProps({ params }) {
  const res = await fetch(`https://.../posts/${params.id}`)
  const post = await res.json()

  return { props: { post } }
}

export default function Post({ post }) {
  return <PostLayout post={post} />
}
```

In the `app` directory, `getStaticPaths` is replaced with [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params.md).

[`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params.md) behaves similarly to `getStaticPaths`, but has a simplified API for returning route parameters and can be used inside [layouts](/docs/app/api-reference/file-conventions/layout.md). The return shape of `generateStaticParams` is an array of segments instead of an array of nested `param` objects or a string of resolved paths.

```jsx filename="app/posts/[id]/page.js"
// `app` directory
import PostLayout from '@/components/post-layout'

export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }]
}

async function getPost(params) {
  const res = await fetch(`https://.../posts/${(await params).id}`)
  const post = await res.json()

  return post
}

export default async function Post({ params }) {
  const post = await getPost(params)

  return <PostLayout post={post} />
}
```

Using the name `generateStaticParams` is more appropriate than `getStaticPaths` for the new model in the `app` directory. The `get` prefix is replaced with a more descriptive `generate`, which sits better alone now that `getStaticProps` and `getServerSideProps` are no longer necessary. The `Paths` suffix is replaced by `Params`, which is more appropriate for nested routing with multiple dynamic segments.

***

#### Replacing `fallback`

In the `pages` directory, the `fallback` property returned from `getStaticPaths` is used to define the behavior of a page that isn't pre-rendered at build time. This property can be set to `true` to show a fallback page while the page is being generated, `false` to show a 404 page, or `blocking` to generate the page at request time.

```jsx filename="pages/posts/[id].js"
// `pages` directory

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking'
  };
}

export async function getStaticProps({ params }) {
  ...
}

export default function Post({ post }) {
  return ...
}
```

In the `app` directory the [`config.dynamicParams` property](/docs/app/api-reference/file-conventions/route-segment-config.md#dynamicparams) controls how params outside of [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params.md) are handled:

* **`true`**: (default) Dynamic segments not included in `generateStaticParams` are generated on demand.
* **`false`**: Dynamic segments not included in `generateStaticParams` will return a 404.

This replaces the `fallback: true | false | 'blocking'` option of `getStaticPaths` in the `pages` directory. The `fallback: 'blocking'` option is not included in `dynamicParams` because the difference between `'blocking'` and `true` is negligible with streaming.

```jsx filename="app/posts/[id]/page.js"
// `app` directory

export const dynamicParams = true;

export async function generateStaticParams() {
  return [...]
}

async function getPost(params) {
  ...
}

export default async function Post({ params }) {
  const post = await getPost(params);

  return ...
}
```

With [`dynamicParams`](/docs/app/api-reference/file-conventions/route-segment-config.md#dynamicparams) set to `true` (the default), when a route segment is requested that hasn't been generated, it will be server-rendered and cached.

#### Incremental Static Regeneration (`getStaticProps` with `revalidate`)

In the `pages` directory, the `getStaticProps` function allows you to add a `revalidate` field to automatically regenerate a page after a certain amount of time.

```jsx filename="pages/index.js"
// `pages` directory

export async function getStaticProps() {
  const res = await fetch(`https://.../posts`)
  const posts = await res.json()

  return {
    props: { posts },
    revalidate: 60,
  }
}

export default function Index({ posts }) {
  return (
    <Layout>
      <PostList posts={posts} />
    </Layout>
  )
}
```

In the `app` directory, data fetching with [`fetch()`](/docs/app/api-reference/functions/fetch.md) can use `revalidate`, which will cache the request for the specified amount of seconds.

```jsx filename="app/page.js"
// `app` directory

async function getPosts() {
  const res = await fetch(`https://.../posts`, { next: { revalidate: 60 } })
  const data = await res.json()

  return data.posts
}

export default async function PostList() {
  const posts = await getPosts()

  return posts.map((post) => <div>{post.name}</div>)
}
```

#### API Routes

API Routes continue to work in the `pages/api` directory without any changes. However, they have been replaced by [Route Handlers](/docs/app/api-reference/file-conventions/route.md) in the `app` directory.

Route Handlers allow you to create custom request handlers for a given route using the Web [Request](https://developer.mozilla.org/docs/Web/API/Request) and [Response](https://developer.mozilla.org/docs/Web/API/Response) APIs.

```ts filename="app/api/route.ts" switcher
export async function GET(request: Request) {}
```

```js filename="app/api/route.js" switcher
export async function GET(request) {}
```

> **Good to know**: If you previously used API routes to call an external API from the client, you can now use [Server Components](/docs/app/getting-started/server-and-client-components.md) instead to securely fetch data. Learn more about [data fetching](/docs/app/getting-started/fetching-data.md).

#### Single-Page Applications

If you are also migrating to Next.js from a Single-Page Application (SPA) at the same time, see our [documentation](/docs/app/guides/single-page-applications.md) to learn more.

### Step 7: Styling

In the `pages` directory, global stylesheets are restricted to only `pages/_app.js`. With the `app` directory, this restriction has been lifted. Global styles can be added to any layout, page, or component.

* [CSS Modules](/docs/app/getting-started/css.md#css-modules)
* [Tailwind CSS](/docs/app/getting-started/css.md#tailwind-css)
* [Global Styles](/docs/app/getting-started/css.md#global-css)
* [CSS-in-JS](/docs/app/guides/css-in-js.md)
* [External Stylesheets](/docs/app/getting-started/css.md#external-stylesheets)
* [Sass](/docs/app/guides/sass.md)


## Using App Router together with Pages Router

When navigating between routes served by the different Next.js routers, there will be a hard navigation. Automatic link prefetching with `next/link` will not prefetch across routers.

Instead, you can [optimize navigations](https://vercel.com/guides/optimizing-hard-navigations) between App Router and Pages Router to retain the prefetched and fast page transitions. [Learn more](https://vercel.com/guides/optimizing-hard-navigations).

## Codemods

Next.js provides Codemod transformations to help upgrade your codebase when a feature is deprecated. See [Codemods](/docs/app/guides/upgrading/codemods.md) for more information.
"""  # <-- paste the official Next.js App Router migration guide here (optional)

# ---------------- Logging ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)


# ---------------- Azure helpers ----------------
def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Environment variable {name} is not set")
    return val


def _sanitize_host(host: str) -> str:
    h = host.strip()
    if h.startswith("https://"):
        h = h[len("https://") :]
    elif h.startswith("http://"):
        h = h[len("http://") :]
    return h.lstrip("/")


import json, time, logging, http.client, sys

import json, time, logging, http.client, sys

def azure_chat_completion(messages, max_retries=3, max_completion_tokens=30000, show_thinking=True, debug_payloads=False):
    """
    Stream from Azure Chat Completions and print tokens live, including reasoning when available.
    - Avoids 'list index out of range' by guarding for chunks without choices.
    - Does NOT send unsupported params like temperature if your model doesn't allow it.
    """
    api_host = _sanitize_host(_require_env("AZURE_API_HOST"))
    deployment = _require_env("AZURE_API_MODEL")
    api_key = _require_env("AZURE_API_KEY")
    path = f"/openai/deployments/{deployment}/chat/completions?api-version={API_VERSION}"

    # Only include fields your deployment supports.
    body = {
        "messages": messages,
        "stream": True,
        "max_completion_tokens": max_completion_tokens,
        # If your model supports it, you can also add:
        # "reasoning": {"effort": "medium"},
    }
    headers = {"api-key": api_key, "Content-Type": "application/json; charset=utf-8"}

    backoff = 1.6
    for attempt in range(1, max_retries + 1):
        try:
            conn = http.client.HTTPSConnection(api_host, timeout=300)
            conn.request("POST", path, body=json.dumps(body).encode("utf-8"), headers=headers)
            res = conn.getresponse()

            if not (200 <= res.status < 300):
                raw = res.read().decode("utf-8", errors="replace")
                conn.close()
                raise RuntimeError(f"Azure error HTTP {res.status}: {raw[:300]}")

            print("\n--- Streaming response ---\n", flush=True)
            full_text = []
            thinking_buf = []

            while True:
                line = res.readline()
                if not line:  # EOF
                    break
                if not line.startswith(b"data: "):
                    # ignore comments/blank lines in the SSE stream
                    continue
                payload = line[6:].strip()
                if payload == b"[DONE]":
                    break

                # Optionally dump payloads for debugging rare chunk shapes
                if debug_payloads:
                    try:
                        sys.stderr.write(f"\n[SSE] {payload.decode('utf-8', errors='replace')}\n")
                    except Exception:
                        pass

                # Parse JSON chunk safely
                try:
                    obj = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                choices = obj.get("choices")
                if not choices or not isinstance(choices, list):
                    # Some service-side heartbeats/diagnostics lack choices
                    continue

                c0 = choices[0] if choices else None
                if not c0:
                    continue

                delta = c0.get("delta") or {}

                # 1) Standard assistant tokens
                content = delta.get("content")
                if isinstance(content, str) and content:
                    sys.stdout.write(content)
                    sys.stdout.flush()
                    full_text.append(content)

                # 2) Reasoning / thinking tokens (several possible shapes)
                if show_thinking:
                    # a) direct "reasoning_content": str
                    rc = delta.get("reasoning_content")
                    if isinstance(rc, str) and rc:
                        sys.stdout.write(f"\033[90m{rc}\033[0m")
                        sys.stdout.flush()
                        thinking_buf.append(rc)

                    # b) nested object e.g. {"reasoning":{"content":"..."}}
                    reasoning_obj = delta.get("reasoning")
                    if isinstance(reasoning_obj, dict):
                        rtxt = reasoning_obj.get("content")
                        if isinstance(rtxt, str) and rtxt:
                            sys.stdout.write(f"\033[90m{rtxt}\033[0m")
                            sys.stdout.flush()
                            thinking_buf.append(rtxt)

                    # c) occasionally content may be an array of parts
                    if isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict):
                                if part.get("type") in ("reasoning", "thinking", "system"):
                                    txt = part.get("text") or part.get("content")
                                    if isinstance(txt, str) and txt:
                                        sys.stdout.write(f"\033[90m{txt}\033[0m")
                                        sys.stdout.flush()
                                        thinking_buf.append(txt)

                # Ignore role/tool_calls/etc. but you could handle them here
                # role = delta.get("role")
                # tool_calls = delta.get("tool_calls")

            conn.close()
            print("\n\n--- End of stream ---\n", flush=True)

            # If you prefer to reveal thinking after, leave this in; otherwise remove.
            if show_thinking and thinking_buf:
                # You might want to log instead of printing:
                # logging.debug("THINKING: %s", "".join(thinking_buf))
                pass

            return "".join(full_text)

        except Exception as e:
            if attempt == max_retries:
                raise
            sleep_s = backoff ** attempt
            logging.warning("Azure call failed (%s). Retrying in %.1fs", e, sleep_s)
            time.sleep(sleep_s)


# ---------------- Utilities ----------------
FENCE_MARKERS = ("```tsx", "```ts", "```jsx", "```js", "```json", "```")


def strip_code_fences(text: str) -> str:
    s = text.strip()
    for m in FENCE_MARKERS:
        if s.startswith(m):
            s = s.split("\n", 1)[-1]
            break
    if s.endswith("```"):
        s = s[:-3]
    return s.strip()


def sha256_str(x: str) -> str:
    return hashlib.sha256(x.encode("utf-8")).hexdigest()


def unified_diff(a_text: str, b_text: str, path: str) -> str:
    a_lines = a_text.splitlines(keepends=True)
    b_lines = b_text.splitlines(keepends=True)
    return "".join(
        difflib.unified_diff(
            a_lines, b_lines, fromfile=f"{path} (original)", tofile=f"{path} (migrated)"
        )
    )


def ensure_parent_dir(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def write_with_backup(path: str, content: str):
    ensure_parent_dir(path)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            old = f.read()
        if old == content:
            return False
        with open(path + ".bak", "w", encoding="utf-8") as bf:
            bf.write(old)
    with open(path, "w", encoding="utf-8") as wf:
        wf.write(content)
    return True


# ---------------- Prompts ----------------
SYSTEM_PROMPT_BASE = """You are a senior Next.js engineer.
Goal: migrate code to Next.js App Router (Next 13+).

STRICT RULES:
- If the input is a route (e.g., app/**/page.tsx), update to App Router idioms.
- Add 'use client' ONLY if file uses client-only features (hooks with state/effects/refs, next/navigation hooks, event handlers).
- Replace next/router with next/navigation (useRouter/usePathname/useSearchParams). Update usages accordingly.
- Replace next/head with the Metadata API. Prefer static `export const metadata`, or `generateMetadata` if values depend on params/search params.
- Replace getServerSideProps/getStaticProps/getInitialProps with Server Component data fetching using fetch():
  * GSSP => { cache: 'no-store' }
  * GSP with revalidate => { next: { revalidate: N } }
- Preserve TypeScript types and behavior. Do NOT add new libraries.
- If input is a colocated component (not a route), keep it as a component and add 'use client' only if necessary.
- If the migration clearly requires additional files for this segment (e.g., layout.tsx, not-found.tsx, error.tsx) OR the code references them,
  RETURN A JSON MANIFEST listing ALL files to write.

OUTPUT FORMAT:
- If a SINGLE file should be returned, output ONLY the final file contents (no markdown fences).
- If MULTIPLE files must be written, output a JSON object:
  { "files": [ { "path": "<repo-relative path>", "contents": "<file contents>" }, ... ] }
  Do not include any commentary.
"""


def build_system_prompt() -> str:
    # If you pasted docs, append them as reference context.
    if NEXT_DOCS.strip():
        return SYSTEM_PROMPT_BASE + "\n\nREFERENCE DOCUMENTATION:\n" + NEXT_DOCS.strip()
    return SYSTEM_PROMPT_BASE


def user_prompt_for_file(rel_path: str, original: str) -> str:
    return f"""We are migrating a Next.js project from the Pages Router to the App Router.

**Migration Context:**
A preliminary script has already handled the file system restructuring. It moved and renamed files from the `/pages` directory to their new locations in the `/app` directory (e.g., `pages/about.tsx` became `app/about/page.tsx`). The file content itself has NOT been modified yet. Your only task is to update the source code below to align with its new App Router path and conventions. Do not suggest file moves or renames.

Repository path: {rel_path}

IMPORTANT: The file path above is the new, correct path in the App Router structure. Use it to infer route parameters.
- [id] = dynamic segment named "id"
- [slug] = dynamic segment named "slug"
- [...path] = catch-all segment named "path"
- ONLY use useParams<{{ id: string }}>() if BOTH conditions are met:
  1. The file path contains dynamic segments like [id], [slug], etc.
  2. The original code actually uses router.query to access those route parameters.
- ONLY use useSearchParams() if the original code uses router.query for URL search parameters (e.g., ?param=value).
- If the original code doesn't access any route or search parameters, do NOT add `useParams` or `useSearchParams` hooks.
- If the original code uses waitUntilQueryParametersReady, remove it. Also if parameters are passed to the page as arguments, remove them as well.
- Example: `app/posts/[id]/page.tsx` with `router.query.id` → use `useParams<{{ id: string }}>()`
- Example: `app/posts/page.tsx` with `router.query.search` → use `useSearchParams()`

Task:
- Migrate the source code below for the App Router.
- The primary changes will involve:
  - Adding `'use client'` if hooks like `useState`, `useEffect`, or `useRouter` are used.
  - Replacing `next/router` imports/hooks with `next/navigation`.
  - Updating data fetching logic if necessary (though this may require manual review).
- Preserve all original logic and behavior as closely as possible.
- Don't remove existing comments unless they are wrong after the migration, don't add new comments.

SOURCE:
<<CODE
{original}
CODE>>
"""


# ---------------- Discovery ----------------
DEFAULT_EXTS = (".tsx", ".ts", ".jsx", ".js")
SKIP_DIRS = {".next", "node_modules", "dist", "build"}


def iter_source_files(
    root: str, include_globs: List[str], exclude_globs: List[str]
) -> Iterable[str]:
    for dirpath, dirnames, filenames in os.walk(root):
        if os.path.basename(dirpath) in SKIP_DIRS:
            continue
        for fn in filenames:
            if not fn.endswith(DEFAULT_EXTS):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root)
            if include_globs and not any(
                fnmatch.fnmatch(rel, pat) for pat in include_globs
            ):
                continue
            if exclude_globs and any(
                fnmatch.fnmatch(rel, pat) for pat in exclude_globs
            ):
                continue
            yield full


# ---------------- Scaffolding ----------------
ROOT_LAYOUT = """export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
"""

ROOT_NOT_FOUND = """export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Not Found</h1>
      <p>The requested resource could not be found.</p>
    </div>
  );
}
"""

ROOT_ERROR = """'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body>
        <h2>Something went wrong</h2>
        <pre>{error.message}</pre>
      </body>
    </html>
  );
}
"""

# Uncomment if you prefer to scaffold a default loading UI
# ROOT_LOADING = """export default function Loading() {
#   return <div>Loading…</div>;
# }
# """


def scaffold_root(app_root: str, write: bool) -> List[str]:
    """Create minimal root special files if missing."""
    created = []
    targets = [
        ("layout.tsx", ROOT_LAYOUT),
        ("not-found.tsx", ROOT_NOT_FOUND),
        ("error.tsx", ROOT_ERROR),
        # ("loading.tsx", ROOT_LOADING),  # opt-in
    ]
    for name, contents in targets:
        path = os.path.join(app_root, name)
        if not os.path.exists(path):
            if write:
                changed = write_with_backup(path, contents)
                if changed:
                    created.append(path)
            else:
                # Dry-run: show what would be created
                print(f"--- would create: {path}\n{contents}\n")
                created.append(path)
    return created


# ---------------- Processing ----------------
def process_file(
    full_path: str, repo_cwd: str, project_root: str, write: bool
) -> Tuple[bool, List[str]]:
    """Migrate a single file. Supports single-file output or a manifest with multiple files."""
    created_paths: List[str] = []
    with open(full_path, "r", encoding="utf-8") as f:
        original = f.read()

    rel_repo = os.path.relpath(full_path, start=repo_cwd)
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": user_prompt_for_file(rel_repo, original)},
    ]
    logging.info("Migrating: %s", rel_repo)
    raw = azure_chat_completion(messages, debug_payloads=True)
    content = strip_code_fences(raw)

    # Try to detect a multi-file manifest
    wrote_any = False
    manifest_mode = False
    try:
        parsed = json.loads(content)
        if (
            isinstance(parsed, dict)
            and "files" in parsed
            and isinstance(parsed["files"], list)
        ):
            manifest_mode = True
            for item in parsed["files"]:
                path = item["path"]
                body = item["contents"]
                # If the model returned a repo-relative path, keep it; else resolve.
                abs_path = (
                    os.path.join(repo_cwd, path) if not os.path.isabs(path) else path
                )
                if not write:
                    print(f"--- {rel_repo} -> would write manifest file: {abs_path}\n")
                    print(unified_diff("", body, abs_path) or body)
                else:
                    changed = write_with_backup(abs_path, body)
                    if changed:
                        created_paths.append(abs_path)
                        wrote_any = True
    except Exception:
        # Not a manifest; treat as single-file replacement
        pass

    if not manifest_mode:
        # Single-file rewrite
        migrated = content
        if sha256_str(migrated) == sha256_str(original):
            logging.info("No changes for %s", rel_repo)
            return False, created_paths
        if not write:
            print(unified_diff(original, migrated, rel_repo))
            wrote_any = True
        else:
            with open(full_path, "w", encoding="utf-8") as wf:
                wf.write(migrated)
            logging.info("Wrote %s", rel_repo)
            wrote_any = True

    return wrote_any, created_paths


def main():
    parser = argparse.ArgumentParser(
        description="Migrate Next.js files to App Router using Azure OpenAI, with optional scaffolding."
    )
    parser.add_argument(
        "--root", default="services/main-frontend/src/app", help="App directory root"
    )
    parser.add_argument(
        "--include",
        nargs="*",
        default=[],
        help="Glob(s) to include relative to --root (e.g. '**/page.tsx')",
    )
    parser.add_argument(
        "--exclude",
        nargs="*",
        default=[],
        help="Glob(s) to exclude (e.g. '**/components/**')",
    )
    parser.add_argument(
        "--write", action="store_true", help="Write changes (otherwise dry-run)"
    )
    parser.add_argument(
        "--scaffold",
        action="store_true",
        help="Create root special files if missing (layout.tsx, not-found.tsx, error.tsx)",
    )
    args = parser.parse_args()

    # Validate env early
    try:
        _sanitize_host(_require_env("AZURE_API_HOST"))
        _require_env("AZURE_API_MODEL")
        _require_env("AZURE_API_KEY")
    except Exception as e:
        logging.error(str(e))
        sys.exit(2)

    app_root = os.path.abspath(args.root)
    if not os.path.isdir(app_root):
        logging.error("Root '%s' is not a directory", app_root)
        sys.exit(2)

    total = 0
    changed = 0
    created: List[str] = []

    if args.scaffold:
        logging.info("Scaffolding root special files (if missing)…")
        created += scaffold_root(app_root, args.write)

    for path in iter_source_files(app_root, args.include, args.exclude):
        total += 1
        try:
            did_change, newly_created = process_file(
                path, os.getcwd(), app_root, args.write
            )
            if did_change:
                changed += 1
            created += newly_created
        except Exception as e:
            logging.error("Failed to migrate %s: %s", path, e)

    logging.info(
        "Done. Files scanned: %d; changed: %d; created: %d. Mode: %s",
        total,
        changed,
        len(created),
        "WRITE" if args.write else "DRY-RUN",
    )


if __name__ == "__main__":
    main()
