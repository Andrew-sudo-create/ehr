"use client"

import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Trash2, User } from "lucide-react"
import {
  createAppointment,
  deleteAppointment,
  getUpcomingAppointments,
  getPatients,
  type AppointmentSummary,
  type FHIRPatient,
} from "@/lib/fhir"

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"upcoming" | "past" | "all">("upcoming")
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [patients, setPatients] = useState<FHIRPatient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")

  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newTime, setNewTime] = useState("09:00")
  const [newDuration, setNewDuration] = useState(30)
  const [newType, setNewType] = useState("Visit")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const startOfWeek = new Date(currentDate)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
  startOfWeek.setDate(diff)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setPatientsLoading(true)
        setError(null)

        const [appts, patientList] = await Promise.all([
          getUpcomingAppointments(),
          getPatients(),
        ])

        setAppointments(appts)
        setPatients(patientList)
        if (patientList.length > 0) {
          setSelectedPatientId(patientList[0].id)
        }
      } catch (err) {
        console.error("Error loading appointments:", err)
        setError(err instanceof Error ? err.message : "Failed to load appointments")
      } finally {
        setLoading(false)
        setPatientsLoading(false)
      }
    }
    load()
  }, [])

  const appointmentsByDate = useMemo(() => {
    const now = new Date()
    const result: Record<string, AppointmentSummary[]> = {}

    for (const appt of appointments) {
      const start = appt.start ? new Date(appt.start) : null
      const isPast = start && start.getTime() < now.getTime()

      if (viewMode === "upcoming" && isPast) continue
      if (viewMode === "past" && !isPast) continue

      const key = start ? start.toISOString().slice(0, 10) : ""
      if (!key) continue

      if (!result[key]) result[key] = []
      result[key].push(appt)
    }

    return result
  }, [appointments, viewMode])

  const handleCreate = async () => {
    if (!selectedPatientId || !newDate || !newTime) return

    const patient = patients.find((p) => p.id === selectedPatientId)
    if (!patient) return

    try {
      setCreating(true)
      setError(null)
      const created = await createAppointment({
        patientName: patient.name,
        date: newDate,
        time: newTime,
        durationMinutes: newDuration,
        type: newType,
      })
      setAppointments((prev) => [...prev, created])
    } catch (err) {
      console.error("Error creating appointment:", err)
      setError(err instanceof Error ? err.message : "Failed to create appointment")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!id) return
    const confirmed = window.confirm("Delete this appointment? This cannot be undone.")
    if (!confirmed) return

    try {
      setDeletingId(id)
      setError(null)
      await deleteAppointment(id)
      setAppointments((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error("Error deleting appointment:", err)
      setError(err instanceof Error ? err.message : "Failed to delete appointment")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 pl-[72px] lg:pl-[240px]">
        <Header />
        <main className="p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Schedule
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                View upcoming and past appointments in a calendar view.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "upcoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("upcoming")}
              >
                Upcoming
              </Button>
              <Button
                variant={viewMode === "past" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("past")}
              >
                Past
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("all")}
              >
                All
              </Button>
            </div>
          </div>

          {/* Create appointment */}
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl">
            <CardContent className="pt-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Patient</p>
                  <Select
                    value={selectedPatientId}
                    onValueChange={setSelectedPatientId}
                    disabled={patientsLoading || patients.length === 0}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder={patientsLoading ? "Loading patients..." : "Select patient"} />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Date</p>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-9 w-[160px]"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Time</p>
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="h-9 w-[120px]"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Duration (min)</p>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value) || 30)}
                    className="h-9 w-[120px]"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Type</p>
                  <Input
                    placeholder="e.g. Follow-up"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="h-9 w-[160px]"
                  />
                </div>
                <Button
                  className="mt-2 h-9"
                  onClick={handleCreate}
                  disabled={
                    creating ||
                    patientsLoading ||
                    !selectedPatientId ||
                    !newDate ||
                    !newTime
                  }
                >
                  {creating ? "Creating..." : "Add Appointment"}
                </Button>
              </div>
              {error && (
                <p className="mt-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-medium text-foreground">
                  Week of {formatDate(startOfWeek)}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border/50"
                  onClick={() =>
                    setCurrentDate(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7)
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-border/50"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-border/50"
                  onClick={() =>
                    setCurrentDate(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7)
                    )
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
                {weekDays.map((dayDate) => {
                  const dateKey = dayDate.toISOString().slice(0, 10)
                  const dayAppointments = appointmentsByDate[dateKey] || []
                  const isToday =
                    new Date().toDateString() === dayDate.toDateString()

                  return (
                    <div
                      key={dateKey}
                      className={`flex flex-col rounded-xl border border-border/40 bg-muted/30 p-3 ${
                        isToday ? "ring-1 ring-primary/40" : ""
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {dayDate.toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </p>
                          <p className="text-base font-semibold text-foreground">
                            {dayDate.getDate()}
                          </p>
                        </div>
                        {isToday && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 bg-primary/10 text-[10px] text-primary"
                          >
                            Today
                          </Badge>
                        )}
                      </div>

                      {loading ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Loading...
                        </p>
                      ) : dayAppointments.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No appointments
                        </p>
                      ) : (
                        <div className="mt-1 space-y-2">
                          {dayAppointments.map((appt) => (
                            <div
                              key={appt.id}
                              className="rounded-lg bg-background/60 p-2 text-xs shadow-sm flex items-start justify-between gap-2"
                            >
                              <div className="flex-1">
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="font-medium text-foreground">
                                    {appt.time}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {appt.type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{appt.patientName}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(appt.id)}
                                disabled={deletingId === appt.id}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-primary" />
                    <span>Upcoming appointments are shown in this week view.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

