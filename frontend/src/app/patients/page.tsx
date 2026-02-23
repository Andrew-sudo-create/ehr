"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Phone,
  Mail,
  Calendar,
  FileText,
  Mic,
  ChevronLeft,
  ChevronRight,
  Trash,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import { AddPatientDialog } from "@/components/add-patient-dialog"
import { deletePatient, getPatients, type FHIRPatient } from "@/lib/fhir"

const statusColors: Record<string, string> = {
  Active: "bg-primary/20 text-primary ring-primary/30",
  Critical: "bg-destructive/20 text-destructive ring-destructive/30",
  Stable: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export default function PatientsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "")
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all")
  const [patients, setPatients] = useState<FHIRPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Fetch patients from backend
  const fetchPatients = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPatients()
      setPatients(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients")
      console.error("Error fetching patients:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])

  const handleDelete = async (patientId: string, patientName: string) => {
    const confirmed = window.confirm(`Delete patient "${patientName}"? This cannot be undone.`)
    if (!confirmed) return

    try {
      setDeletingId(patientId)
      setError(null)
      await deletePatient(patientId)
      await fetchPatients()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete patient")
      console.error("Error deleting patient:", err)
    } finally {
      setDeletingId(null)
    }
  }

  // Transform FHIR patients to display format (condition, lastVisit, nextVisit from API)
  const displayPatients = patients.map((patient) => {
    const nameParts = patient.name.split(" ")
    const initials = nameParts
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    
    return {
      id: patient.id || "N/A",
      name: patient.name,
      avatar: "",
      initials,
      age: 0, // Age not available from FHIR without birthDate calculation
      gender: patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1),
      phone: patient.phone || "Not provided",
      email: patient.email || "Not provided",
      condition: patient.condition ?? "None recorded",
      status: "Active" as const,
      lastVisit: patient.lastVisit ?? "No visits",
      nextVisit: patient.nextVisit ?? "None scheduled",
    }
  })

  const filteredPatients = displayPatients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (patient.condition && patient.condition.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus =
      statusFilter === "all" || patient.status.toLowerCase() === statusFilter.toLowerCase()
    return matchesSearch && matchesStatus
  })

  // Pagination: reset to page 1 when filters change; clamp page when total shrinks
  const totalFiltered = filteredPatients.length
  const totalPagesComputed = Math.max(1, Math.ceil(totalFiltered / pageSize))

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  useEffect(() => {
    if (currentPage > totalPagesComputed) setCurrentPage(Math.max(1, totalPagesComputed))
  }, [totalPagesComputed])

  const totalPages = totalPagesComputed
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalFiltered)
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex)

  // Page numbers to show (current and neighbors)
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages: (number | "ellipsis")[] = [1]
    if (safePage > 3) pages.push("ellipsis")
    const midStart = Math.max(2, safePage - 1)
    const midEnd = Math.min(totalPages - 1, safePage + 1)
    for (let i = midStart; i <= midEnd; i++) {
      if (i !== 1 && i !== totalPages) pages.push(i)
    }
    if (safePage < totalPages - 2) pages.push("ellipsis")
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 pl-[72px] lg:pl-[240px]">
          <Header />
          <main className="p-6">
            {/* Page Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Patient List
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage and view all your patients in one place
                </p>
              </div>
              <AddPatientDialog onPatientAdded={fetchPatients} />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={fetchPatients}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Filters Card */}
            <Card className="mb-6 border-border/50 bg-card/50 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or condition..."
                      value={searchQuery}
                      onChange={(e) => {
                        const value = e.target.value
                        setSearchQuery(value)
                        const params = new URLSearchParams(Array.from(searchParams.entries()))
                        if (value) {
                          params.set("q", value)
                        } else {
                          params.delete("q")
                        }
                        const status = params.get("status")
                        const queryString = params.toString()
                        router.push(queryString ? `/patients?${queryString}` : "/patients")
                      }}
                      className="h-10 rounded-xl border-border/50 bg-muted/50 pl-10 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => {
                        setStatusFilter(value)
                        const params = new URLSearchParams(Array.from(searchParams.entries()))
                        if (value && value !== "all") {
                          params.set("status", value)
                        } else {
                          params.delete("status")
                        }
                        if (searchQuery) {
                          params.set("q", searchQuery)
                        }
                        const queryString = params.toString()
                        router.push(queryString ? `/patients?${queryString}` : "/patients")
                      }}
                    >
                      <SelectTrigger className="h-10 w-[140px] rounded-xl border-border/50 bg-muted/50">
                        <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 bg-popover/95 backdrop-blur-xl">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="stable">Stable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patients Table */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center justify-between text-base font-medium text-foreground">
                  <span>All Patients ({filteredPatients.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Patient
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Contact
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Condition
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Last Visit
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Next Visit
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                            <p className="text-sm text-muted-foreground">Loading patients...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredPatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <p className="text-sm text-muted-foreground">
                            {searchQuery || statusFilter !== "all" 
                              ? "No patients found matching your filters." 
                              : "No patients found. Click 'Add New Patient' to get started."}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPatients.map((patient) => (
                        <TableRow
                          key={patient.id}
                          className="border-border/50 transition-colors hover:bg-muted/30"
                        >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-border/50">
                              <AvatarImage src={patient.avatar || "/placeholder.svg"} alt={patient.name} />
                              <AvatarFallback className="bg-primary/20 text-xs text-primary">
                                {patient.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{patient.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {patient.id} {patient.age > 0 ? `| ${patient.age}y, ` : ""}{patient.gender}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{patient.phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="max-w-[150px] truncate">{patient.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">{patient.condition}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{patient.lastVisit}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <span>{patient.nextVisit}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-lg ring-1 ${statusColors[patient.status]}`}
                          >
                            {patient.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 rounded-xl border-border/50 bg-popover/95 backdrop-blur-xl"
                            >
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 rounded-lg focus:bg-muted/50"
                                onClick={() => router.push(`/patients/${patient.id}`)}
                              >
                                <FileText className="h-4 w-4" />
                                View Records
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg focus:bg-muted/50">
                                <Mic className="h-4 w-4" />
                                Start Scribe
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg focus:bg-muted/50">
                                <Calendar className="h-4 w-4" />
                                Schedule Visit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 rounded-lg text-destructive focus:bg-muted/50"
                                onClick={() => handleDelete(patient.id, patient.name)}
                                disabled={deletingId === patient.id}
                              >
                                <Trash className="h-4 w-4" />
                                {deletingId === patient.id ? "Deleting..." : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {!loading && filteredPatients.length > 0 && (
                  <div className="flex flex-col gap-4 border-t border-border/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        Showing {startIndex + 1}–{endIndex} of {totalFiltered} patients
                        {searchQuery || statusFilter !== "all" ? " (filtered)" : ""}
                      </p>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => {
                          setPageSize(Number(v))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 w-[100px] rounded-lg border-border/50 bg-transparent text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} per page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/50 bg-transparent"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {getPageNumbers().map((n, i) =>
                          n === "ellipsis" ? (
                            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">
                              …
                            </span>
                          ) : (
                            <Button
                              key={n}
                              variant="outline"
                              size="sm"
                              className={`h-8 min-w-[32px] rounded-lg ${
                                n === safePage
                                  ? "border-primary bg-primary/20 text-primary"
                                  : "border-border/50 bg-transparent"
                              }`}
                              onClick={() => setCurrentPage(n)}
                            >
                              {n}
                            </Button>
                          )
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/50 bg-transparent"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </Suspense>
  )
}
