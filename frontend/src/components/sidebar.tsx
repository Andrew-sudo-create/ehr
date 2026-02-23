"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Mic,
  Settings,
  Stethoscope,
  CalendarDays,
  Puzzle,
  CreditCard,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    label: "Patient List",
    icon: Users,
    href: "/patients",
  },
  {
    label: "Schedule",
    icon: CalendarDays,
    href: "/schedule",
  },
  {
    label: "Ambient Scribe",
    icon: Mic,
    href: "/scribe",
  },
  {
    label: "Extensions",
    icon: Puzzle,
    href: "/extensions",
  },
  {
    label: "Billing",
    icon: CreditCard,
    href: "/billing",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[72px] flex-col items-center border-r border-border/50 bg-sidebar/80 py-6 backdrop-blur-xl lg:w-[240px]">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3 px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30">
          <Stethoscope className="h-5 w-5 text-primary" />
        </div>
        <span className="hidden text-lg font-semibold tracking-tight text-foreground lg:block">
          MedScribe
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2 px-3 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent/80",
                isActive
                  ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="hidden lg:block">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto px-3 w-full">
        <div className="hidden lg:block rounded-xl bg-primary/10 p-4 ring-1 ring-primary/20">
          <p className="text-xs font-medium text-primary">Pro Plan Active</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Unlimited AI transcriptions
          </p>
        </div>
      </div>
    </aside>
  )
}
