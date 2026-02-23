 "use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { StatsCards } from "@/components/stats-cards"
import { AppointmentsCard } from "@/components/appointments-card"
import { RecentNotesCard } from "@/components/recent-notes-card"
import { useDoctorProfile } from "@/components/doctor-profile-provider"

export default function DashboardPage() {
  const router = useRouter()
  const { profile } = useDoctorProfile()

  const todayGreeting = useMemo(() => {
    const now = new Date()
    const hours = now.getHours()
    if (hours < 12) return "Good morning"
    if (hours < 18) return "Good afternoon"
    return "Good evening"
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col pl-[72px] lg:pl-[240px]">
        <Header />

        <main className="flex-1 p-6">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">
              {todayGreeting}, Dr. {profile.lastName || profile.firstName || ""}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {"Here is a quick overview of your day."}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="mb-8">
            <StatsCards />
          </div>

          {/* Main Grid */}
          <div className="grid gap-6 xl:grid-cols-2">
            <AppointmentsCard />
            <RecentNotesCard />
          </div>

          {/* Quick Actions */}
          <div className="mt-8 rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionButton
                label="New Patient"
                description="Register a new patient"
                gradient="from-primary/20 to-primary/5"
                onClick={() => router.push("/patients")}
              />
              <QuickActionButton
                label="Start Recording"
                description="Begin ambient scribe session"
                gradient="from-emerald-500/20 to-emerald-500/5"
              />
              <QuickActionButton
                label="View Schedule"
                description="See your full calendar"
                gradient="from-amber-500/20 to-amber-500/5"
                onClick={() => router.push("/schedule")}
              />
              <QuickActionButton
                label="Generate Report"
                description="Create summary reports"
                gradient="from-rose-500/20 to-rose-500/5"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function QuickActionButton({
  label,
  description,
  gradient,
  onClick,
}: {
  label: string
  description: string
  gradient: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`group flex flex-col items-start rounded-xl bg-gradient-to-br ${gradient} p-4 text-left ring-1 ring-border/50 transition-all duration-200 hover:ring-primary/30`}
      onClick={onClick}
    >
      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
      <span className="mt-1 text-sm text-muted-foreground">{description}</span>
    </button>
  )
}
