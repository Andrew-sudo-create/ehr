"use client"

import { Users, Mic, FileText, Clock, Calendar, UserCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { getBackendApiUrl } from "@/lib/fhir"

interface StatsData {
  patientsToday: number
  activeSessions: number
  notesGenerated: number
  avgNoteTime: string | number
  totalPatients: number
  totalAppointments: number
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const apiUrl = getBackendApiUrl()
        const response = await fetch(`${apiUrl}/api/dashboard/stats`)
        if (!response.ok) {
          throw new Error("Failed to fetch statistics")
        }
        const data = await response.json()
        setStats({
          ...data,
          totalPatients: data.totalPatients ?? 0,
          totalAppointments: data.totalAppointments ?? 0,
        })
        setError(null)
      } catch (err) {
        console.error("Error fetching dashboard stats:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setStats(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm animate-pulse"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/15 mb-4" />
            <div className="h-8 w-16 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  const statsList = [
    {
      label: "Total Patients",
      value: String(stats.totalPatients),
      change: "In system",
      icon: Users,
      trend: "neutral" as const,
    },
    {
      label: "Appointments Today",
      value: String(stats.patientsToday),
      change: stats.patientsToday === 0 ? "None scheduled" : "Scheduled",
      icon: UserCheck,
      trend: stats.patientsToday > 0 ? ("up" as const) : ("neutral" as const),
    },
    {
      label: "Upcoming Appointments",
      value: String(stats.totalAppointments),
      change: "Total scheduled",
      icon: Calendar,
      trend: "neutral" as const,
    },
    {
      label: "Notes Generated",
      value: String(stats.notesGenerated),
      change: "Documents on file",
      icon: FileText,
      trend: "neutral" as const,
    },
    {
      label: "Avg. Note Time",
      value: `${stats.avgNoteTime}m`,
      change: "Per document",
      icon: Clock,
      trend: "neutral" as const,
    },
    {
      label: "Active Sessions",
      value: String(stats.activeSessions),
      change: "Scribe recording",
      icon: Mic,
      trend: "neutral" as const,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {error && (
        <div className="col-span-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {statsList.map((stat) => (
        <div
          key={stat.label}
          className="group rounded-2xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:bg-card/80"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30 transition-all group-hover:bg-primary/20">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <span
              className={`text-xs font-medium ${
                stat.trend === "up"
                  ? "text-emerald-400"
                  : stat.trend === "down"
                    ? "text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {stat.change}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
