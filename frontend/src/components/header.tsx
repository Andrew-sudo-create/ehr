"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Bell, ChevronDown, LogOut, Search, User, Settings } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useDoctorProfile } from "@/components/doctor-profile-provider"
import { getDoctorDisplayName, getInitials } from "@/lib/doctor-profile"

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { profile } = useDoctorProfile()
  const displayName = getDoctorDisplayName(profile)
  const initials = getInitials(profile)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
      {/* Search Bar (hidden on settings, extensions, and scribe pages) */}
      {pathname?.startsWith("/settings") || pathname?.startsWith("/extensions") || pathname?.startsWith("/scribe") ? (
        <div className="flex-1" />
      ) : (
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search patients by name, ID, or condition..."
            className="h-10 w-full rounded-xl border-border/50 bg-muted/50 pl-10 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
          />
        </div>
      )}

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        {/* Doctor Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-10 items-center gap-3 rounded-xl px-3 hover:bg-muted/50"
            >
              <Avatar className="h-8 w-8 ring-2 ring-primary/30">
                <AvatarImage src={profile.avatarUrl || "/placeholder.svg"} alt={displayName} />
                <AvatarFallback className="bg-primary/20 text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{profile.specialty}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl border-border/50 bg-popover/95 backdrop-blur-xl"
          >
            <DropdownMenuLabel className="text-foreground">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              className="cursor-pointer rounded-lg focus:bg-muted/50"
              onClick={() => router.push("/settings")}
            >
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg focus:bg-muted/50"
              onClick={() => router.push("/settings")}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="cursor-pointer rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
