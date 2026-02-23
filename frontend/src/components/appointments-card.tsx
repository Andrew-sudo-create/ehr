"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, Mic, ChevronRight } from "lucide-react"
import { getUpcomingAppointments, type AppointmentSummary } from "@/lib/fhir"

type DisplayAppointment = {
  id: string
  name: string
  initials: string
  time: string
  duration: string
  type: string
  status: "now" | "next" | "upcoming"
}

export function AppointmentsCard() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const appts = await getUpcomingAppointments()
        setAppointments(appts.slice(0, 4)) // show next 4
      } catch (err) {
        console.error("Error loading appointments:", err)
        setError(err instanceof Error ? err.message : "Failed to load appointments")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const displayAppointments: DisplayAppointment[] = useMemo(() => {
    if (appointments.length === 0) return []

    return appointments.map((appt, index) => {
      let status: "now" | "next" | "upcoming" = "upcoming"
      if (index === 0) status = "now"
      else if (index === 1) status = "next"

      const duration =
        appt.durationMinutes != null ? `${appt.durationMinutes} min` : "—"

      return {
        id: appt.id,
        name: appt.patientName,
        initials: appt.patientInitials,
        time: appt.time,
        duration,
        type: appt.type,
        status,
      }
    })
  }, [appointments])

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
  }, [])

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Next Appointments</h2>
          <p className="text-sm text-muted-foreground">
            {todayLabel}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => router.push("/schedule")}
        >
          View All
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {error && (
        <p className="mb-3 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading appointments...</p>
        ) : displayAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming appointments found.
          </p>
        ) : (
          displayAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className={`group flex items-center justify-between rounded-xl p-4 transition-all duration-200 ${
                appointment.status === "now"
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-11 w-11 ring-2 ring-border/50">
                  <AvatarImage src={`/patient-${appointment.id}.jpg`} />
                  <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
                    {appointment.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{appointment.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {appointment.time}
                    </span>
                    <span className="text-border">•</span>
                    <span>{appointment.duration}</span>
                    <span className="text-border">•</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        appointment.type === "New Patient"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {appointment.type}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                className={`gap-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80`}
                disabled
              >
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">Scribe (coming soon)</span>
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
