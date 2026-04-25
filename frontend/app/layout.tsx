import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '个人记账本',
  description: '记录收入和支出的个人记账应用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <nav className="bg-white shadow-md">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                <Link href="/" className="text-xl font-bold text-gray-800">
                  📒 个人记账本
                </Link>
                <div className="flex space-x-2 sm:space-x-4">
                  <NavLink href="/">首页</NavLink>
                  <NavLink href="/stats">统计</NavLink>
                  <NavLink href="/budget">预算</NavLink>
                </div>
              </div>
            </div>
          </nav>
          <main className="flex-1 bg-gray-50">
            {children}
          </main>
          <footer className="bg-gray-100 py-4 text-center text-gray-600 text-sm">
            © 2024 个人记账本
          </footer>
        </div>
      </body>
    </html>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href
  
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md font-medium transition-colors text-sm sm:text-base ${
        isActive
          ? 'bg-blue-500 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  )
}
