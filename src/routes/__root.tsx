import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'ShopCraft — Premium Products',
      },
    ],
  }),
  component: RootLayout,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b sticky top-0 bg-white z-10">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight">
            ShopCraft
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link to="/" className="hover:underline">
              Products
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} ShopCraft. All rights reserved.
      </footer>
    </div>
  )
}
