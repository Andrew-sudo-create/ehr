"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronLeft, FlaskConical, HeartPulse, Pill, Stethoscope, Upload, Download, Trash2, FileText, FileEdit } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPatientDetails, updatePatient, type PatientDetails, type PatientEvent } from "@/lib/fhir"

interface PatientDocument {
  id: string
  name: string
  uploadedDate: string
  size: number
  type: string
  data?: string
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown date"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function groupEventsByDay(events: PatientEvent[]) {
  const groups: Record<string, PatientEvent[]> = {}
  for (const event of events) {
    const d = event.date ? new Date(event.date) : null
    const key = d && !Number.isNaN(d.getTime())
      ? d.toISOString().slice(0, 10)
      : "Unknown date"
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }
  return Object.entries(groups).sort(([a], [b]) => (a < b ? 1 : -1))
}

export default function PatientDetailsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const patientId = params?.id

  const [details, setDetails] = useState<PatientDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditingPatient, setIsEditingPatient] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState("unknown")
  const [birthDate, setBirthDate] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [addressLine, setAddressLine] = useState("")
  const [city, setCity] = useState("")
  const [state, setStateVal] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("")
  const [medicalAid, setMedicalAid] = useState("")

  // Store original values for cancel functionality
  const [originalFirstName, setOriginalFirstName] = useState("")
  const [originalLastName, setOriginalLastName] = useState("")
  const [originalGender, setOriginalGender] = useState("unknown")
  const [originalBirthDate, setOriginalBirthDate] = useState("")
  const [originalPhone, setOriginalPhone] = useState("")
  const [originalEmail, setOriginalEmail] = useState("")
  const [originalAddressLine, setOriginalAddressLine] = useState("")
  const [originalCity, setOriginalCity] = useState("")
  const [originalState, setOriginalState] = useState("")
  const [originalPostalCode, setOriginalPostalCode] = useState("")
  const [originalCountry, setOriginalCountry] = useState("")
  const [originalMedicalAid, setOriginalMedicalAid] = useState("")

  // Documents state
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    if (!patientId) return

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getPatientDetails(patientId)
        setDetails(data)

        // Pre-fill edit fields
        if (data.patient.name) {
          const parts = data.patient.name.split(" ")
          setFirstName(parts[0] || "")
          setLastName(parts.slice(1).join(" ") || "")
          setOriginalFirstName(parts[0] || "")
          setOriginalLastName(parts.slice(1).join(" ") || "")
        }
        setGender(data.patient.gender || "unknown")
        setOriginalGender(data.patient.gender || "unknown")
        setBirthDate(data.patient.birthDate || "")
        setOriginalBirthDate(data.patient.birthDate || "")
        setPhone(data.patient.phone || "")
        setOriginalPhone(data.patient.phone || "")
        setEmail(data.patient.email || "")
        setOriginalEmail(data.patient.email || "")
        setAddressLine(data.patient.address?.line || "")
        setOriginalAddressLine(data.patient.address?.line || "")
        setCity(data.patient.address?.city || "")
        setOriginalCity(data.patient.address?.city || "")
        setStateVal(data.patient.address?.state || "")
        setOriginalState(data.patient.address?.state || "")
        setPostalCode(data.patient.address?.postalCode || "")
        setOriginalPostalCode(data.patient.address?.postalCode || "")
        setCountry(data.patient.address?.country || "")
        setOriginalCountry(data.patient.address?.country || "")
        setMedicalAid(data.patient.medicalAid || "")
        setOriginalMedicalAid(data.patient.medicalAid || "")
      } catch (err) {
        console.error("Error loading patient details:", err)
        setError(err instanceof Error ? err.message : "Failed to load patient details")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [patientId])

  const groupedEvents = details ? groupEventsByDay(details.events) : []
  const lastVisit = details?.visits[0]

  // Parse lines into SOAP sections when they follow "Subjective:", "Objective:", etc.
  const parseSoap = (lines: string[]): { subjective?: string; objective?: string; assessment?: string; plan?: string } | null => {
    const soap: Record<string, string> = {}
    const keys = ["subjective", "objective", "assessment", "plan"] as const
    const pattern = /^(Subjective|Objective|Assessment|Plan):\s*(.*)$/i
    let found = 0
    for (const line of lines) {
      const m = line.trim().match(pattern)
      if (m) {
        const key = m[1].toLowerCase() as "subjective" | "objective" | "assessment" | "plan"
        soap[key] = m[2].trim()
        found++
      }
    }
    return found > 0 ? (soap as { subjective?: string; objective?: string; assessment?: string; plan?: string }) : null
  }

  // Build clinical notes list: generated summary (SOAP) + all visit notes (SOAP, newest first)
  const clinicalNotes = useMemo(() => {
    if (!details) return []
    const notes: { date: string; title: string; type: "summary" | "visit"; lines: string[] }[] = []
    const visits = details.visits || []
    const conditions = details.conditions || []
    const medications = details.medications || []
    if (visits.length > 0 || conditions.length > 0 || medications.length > 0) {
      const summaryLines = [
        `Subjective: Active conditions: ${conditions.length > 0 ? conditions.map((c) => c.description).join("; ") : "None"}. Patient last seen for ${lastVisit ? (lastVisit.reason || "clinical visit") : "—"}.`,
        `Objective: Last visit ${lastVisit?.date ? formatDate(lastVisit.date) : "—"}. Vitals and labs as in chart.`,
        `Assessment: ${conditions.length > 0 ? conditions.map((c) => c.description).join("; ") : "No active diagnoses"}. Stable.`,
        `Plan: Current medications: ${medications.length > 0 ? medications.slice(0, 3).map((m) => m.medication).join(", ") + (medications.length > 3 ? " and others" : "") : "None"}. Follow up as scheduled.`,
      ]
      notes.push({
        date: new Date().toISOString(),
        title: "Clinical summary",
        type: "summary",
        lines: summaryLines,
      })
    }
    visits
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((v) => {
        const noteLines = v.notes && v.notes.length > 0 ? v.notes : ["No notes recorded for this visit."]
        notes.push({
          date: v.date || "",
          title: v.reason || "Clinical visit",
          type: "visit",
          lines: noteLines,
        })
      })
    if (notes.length === 0 && details.patient?.name) {
      notes.push({
        date: new Date().toISOString(),
        title: "Patient record",
        type: "summary",
        lines: [`No clinical notes recorded yet for ${details.patient.name}. Consultation notes (SOAP format) will appear here.`],
      })
    }
    return notes
  }, [details, lastVisit])

  const fullName = useMemo(() => {
    return `${firstName} ${lastName}`.trim() || details?.patient.name || "Patient"
  }, [firstName, lastName, details?.patient.name])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setUploadingFile(true)
    try {
      for (const file of Array.from(files)) {
        // Read file as base64
        const reader = new FileReader()
        reader.onload = (event) => {
          const fileData = event.target?.result as string
          const newDoc: PatientDocument = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            uploadedDate: new Date().toISOString(),
            size: file.size,
            type: file.type,
            data: fileData,
          }
          setDocuments((prev) => [newDoc, ...prev])
        }
        reader.readAsDataURL(file)
      }
    } finally {
      setUploadingFile(false)
      // Reset input
      e.target.value = ""
    }
  }

  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
  }

  const handleDownloadDocument = (doc: PatientDocument) => {
    if (!doc.data) return
    const link = document.createElement("a")
    link.href = doc.data
    link.download = doc.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSave = async () => {
    if (!patientId) return
    try {
      setSaving(true)
      setError(null)
      await updatePatient(patientId, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        gender,
        birthDate: birthDate || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: {
          line: addressLine || "",
          city,
          state: state,
          postalCode,
          country,
        },
        medicalAid: medicalAid || undefined,
      })
      const refreshed = await getPatientDetails(patientId)
      setDetails(refreshed)
      // Update original values to match current values
      setOriginalFirstName(firstName)
      setOriginalLastName(lastName)
      setOriginalGender(gender)
      setOriginalBirthDate(birthDate)
      setOriginalPhone(phone)
      setOriginalEmail(email)
      setOriginalAddressLine(addressLine)
      setOriginalCity(city)
      setOriginalState(state)
      setOriginalPostalCode(postalCode)
      setOriginalCountry(country)
      setOriginalMedicalAid(medicalAid)
      // Exit edit mode
      setIsEditingPatient(false)
    } catch (err) {
      console.error("Error saving patient:", err)
      setError(err instanceof Error ? err.message : "Failed to save patient")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 pl-[72px] lg:pl-[240px]">
        <Header />
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50"
                onClick={() => router.push("/patients")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {fullName || "Patient Details"}
                </h1>
                {details && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    ID {details.patient.id} ·{" "}
                    {details.patient.gender
                      ? details.patient.gender.charAt(0).toUpperCase() +
                        details.patient.gender.slice(1)
                      : "Unknown gender"}
                    {details.patient.birthDate
                      ? ` · DOB ${formatDate(details.patient.birthDate).split(",")[0]}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="py-4 text-sm text-destructive flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => patientId && getPatientDetails(patientId).then(setDetails).catch((err) => {
                    console.error("Error reloading details:", err)
                    setError(err instanceof Error ? err.message : "Failed to reload details")
                  })}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            {/* Timeline */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Clinical timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading timeline...</p>
                ) : !details || groupedEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No clinical history available for this patient.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {groupedEvents.map(([dateKey, events]) => (
                      <div key={dateKey} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {dateKey === "Unknown date"
                              ? "Unknown date"
                              : new Date(dateKey).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                          </span>
                        </div>
                        <div className="space-y-3 border-l border-border/50 pl-4">
                          {events.map((event, idx) => {
                            const isVisit = event.kind === "visit"
                            const data = event.data as any
                            return (
                              <div
                                key={idx}
                                className="rounded-lg border border-border/50 bg-muted/40 p-3 text-sm"
                              >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {isVisit ? (
                                      <Badge
                                        variant="outline"
                                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                      >
                                        Visit
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="border-primary/40 bg-primary/10 text-primary"
                                      >
                                        Lab
                                      </Badge>
                                    )}
                                    {isVisit ? (
                                      <span className="font-medium text-foreground">
                                        {data.reason || "Clinical visit"}
                                      </span>
                                    ) : (
                                      <span className="font-medium text-foreground">
                                        {data.type}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(event.date)}
                                  </span>
                                </div>

                                {isVisit ? (
                                  <>
                                    {data.cptCode && (
                                      <p className="text-xs text-muted-foreground">
                                        CPT:{" "}
                                        <span className="font-medium text-foreground">
                                          {data.cptCode}
                                        </span>
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Status:{" "}
                                      <span className="font-medium text-foreground">
                                        {data.status || "Unknown"}
                                      </span>
                                    </p>
                                    {data.notes && data.notes.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-xs font-medium text-foreground">
                                          Visit notes / scribe summary
                                        </p>
                                        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                                          {data.notes.map((n: string, i: number) => (
                                            <li key={i}>{n}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {data.result && (
                                      <p className="text-xs text-muted-foreground">
                                        Result:{" "}
                                        <span className="font-medium text-foreground">
                                          {data.result}
                                        </span>
                                      </p>
                                    )}
                                    {data.interpretation && (
                                      <p className="text-xs text-muted-foreground">
                                        Interpretation:{" "}
                                        <span className="font-medium text-foreground">
                                          {data.interpretation}
                                        </span>
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary / last visit */}
            <div className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-3">
                  <CardTitle className="text-base font-medium">
                    Personal & Contact Information
                  </CardTitle>
                  {!isEditingPatient && (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditingPatient(true)}
                      className="border-border/50 hover:bg-secondary/50"
                    >
                      Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-sm">
                  {isEditingPatient ? (
                    <>
                      {/* Edit Mode */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">First name</Label>
                          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Last name</Label>
                          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Gender</Label>
                          <Input value={gender} onChange={(e) => setGender(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Birth date</Label>
                          <Input type="date" value={birthDate || ""} onChange={(e) => setBirthDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone</Label>
                          <Input value={phone || ""} onChange={(e) => setPhone(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <Input value={email || ""} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs text-muted-foreground">Address line</Label>
                          <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">City</Label>
                          <Input value={city} onChange={(e) => setCity(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">State</Label>
                          <Input value={state} onChange={(e) => setStateVal(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Postal code</Label>
                          <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Country</Label>
                          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs text-muted-foreground">Medical aid / identifier</Label>
                          <Input value={medicalAid || ""} onChange={(e) => setMedicalAid(e.target.value)} />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setFirstName(originalFirstName)
                            setLastName(originalLastName)
                            setGender(originalGender)
                            setBirthDate(originalBirthDate)
                            setPhone(originalPhone)
                            setEmail(originalEmail)
                            setAddressLine(originalAddressLine)
                            setCity(originalCity)
                            setStateVal(originalState)
                            setPostalCode(originalPostalCode)
                            setCountry(originalCountry)
                            setMedicalAid(originalMedicalAid)
                            setIsEditingPatient(false)
                          }}
                          className="border-border/50 hover:bg-secondary/50"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* View Mode */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">First name</Label>
                          <p className="text-foreground font-medium">{firstName}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Last name</Label>
                          <p className="text-foreground font-medium">{lastName}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Gender</Label>
                          <p className="text-foreground font-medium">{gender}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Birth date</Label>
                          <p className="text-foreground font-medium">{birthDate || "Not provided"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone</Label>
                          <p className="text-foreground font-medium">{phone || "Not provided"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <p className="text-foreground font-medium">{email || "Not provided"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs text-muted-foreground">Address line</Label>
                          <p className="text-foreground font-medium">{addressLine || "Not provided"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">City</Label>
                          <p className="text-foreground font-medium">{city || "Not provided"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">State</Label>
                          <p className="text-foreground font-medium">{state || "Not provided"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Postal code</Label>
                          <p className="text-foreground font-medium">{postalCode || "Not provided"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Country</Label>
                          <p className="text-foreground font-medium">{country || "Not provided"}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs text-muted-foreground">Medical aid / identifier</Label>
                          <p className="text-foreground font-medium">{medicalAid || "Not provided"}</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Important Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Upload Section */}
                  <div className="border-2 border-dashed border-border/50 rounded-lg p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center">
                    <Label htmlFor="document-upload" className="cursor-pointer w-full">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          Drop files here or click to upload
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                        </span>
                      </div>
                      <Input
                        id="document-upload"
                        type="file"
                        multiple
                        disabled={uploadingFile}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                      />
                    </Label>
                  </div>

                  {/* Documents List */}
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents uploaded yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {doc.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(doc.uploadedDate).toLocaleDateString()} · {(doc.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadDocument(doc)}
                              className="h-8 w-8 p-0 hover:bg-secondary/50"
                              title="Download document"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                              title="Delete document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    Last visit
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 text-sm">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading last visit...</p>
                  ) : !lastVisit ? (
                    <p className="text-sm text-muted-foreground">
                      No visits recorded for this patient yet.
                    </p>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">
                        {lastVisit.reason || "Clinical visit"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(lastVisit.date)}
                      </p>
                      {lastVisit.cptCode && (
                        <p className="text-xs text-muted-foreground">
                          CPT:{" "}
                          <span className="font-medium text-foreground">
                            {lastVisit.cptCode}
                          </span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Status:{" "}
                        <span className="font-medium text-foreground">
                          {lastVisit.status || "Unknown"}
                        </span>
                      </p>
                      {lastVisit.notes && lastVisit.notes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            Notes from the visit
                          </p>
                          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                            {lastVisit.notes.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Clinical notes — generated summary + all visit notes */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <FileEdit className="h-4 w-4 text-primary" />
                    Clinical notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-sm">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading notes...</p>
                  ) : clinicalNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No clinical notes for this patient yet. Notes from consultations and a summary will appear here.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {clinicalNotes.map((note, idx) => {
                        const soap = parseSoap(note.lines)
                        return (
                          <div
                            key={idx}
                            className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{note.title}</span>
                              {note.date && (
                                <span className="text-xs text-muted-foreground">
                                  {note.type === "summary" ? "Generated" : formatDate(note.date)}
                                </span>
                              )}
                            </div>
                            {note.type === "summary" && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary">
                                Summary
                              </span>
                            )}
                            {soap ? (
                              <div className="grid gap-2 text-xs">
                                {soap.subjective != null && (
                                  <div>
                                    <p className="font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Subjective</p>
                                    <p className="text-muted-foreground pl-0">{soap.subjective}</p>
                                  </div>
                                )}
                                {soap.objective != null && (
                                  <div>
                                    <p className="font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Objective</p>
                                    <p className="text-muted-foreground pl-0">{soap.objective}</p>
                                  </div>
                                )}
                                {soap.assessment != null && (
                                  <div>
                                    <p className="font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Assessment</p>
                                    <p className="text-muted-foreground pl-0">{soap.assessment}</p>
                                  </div>
                                )}
                                {soap.plan != null && (
                                  <div>
                                    <p className="font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Plan</p>
                                    <p className="text-muted-foreground pl-0">{soap.plan}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                                {note.lines.map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/40 backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    Recent labs
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 text-sm">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading labs...</p>
                  ) : !details || details.labs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No lab results available for this patient.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {details.labs.slice(0, 5).map((lab) => (
                        <div
                          key={lab.id}
                          className="rounded-lg border border-border/50 bg-muted/30 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">{lab.type}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(lab.date)}
                            </span>
                          </div>
                          {lab.result && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Result:{" "}
                              <span className="font-medium text-foreground">
                                {lab.result}
                              </span>
                            </p>
                          )}
                          {lab.interpretation && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Interpretation:{" "}
                              <span className="font-medium text-foreground">
                                {lab.interpretation}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/40 backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <HeartPulse className="h-4 w-4 text-primary" />
                    Recent vitals
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 text-sm">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading vitals...</p>
                  ) : !details || details.vitals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No vital signs recorded for this patient.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {details.vitals.slice(0, 5).map((vital) => (
                        <div
                          key={vital.id}
                          className="rounded-lg border border-border/50 bg-muted/30 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">{vital.type}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(vital.date)}
                            </span>
                          </div>
                          {vital.value && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Value:{" "}
                              <span className="font-medium text-foreground">
                                {vital.value}
                              </span>
                            </p>
                          )}
                          {vital.code && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Code: {vital.code}
                              {vital.system ? ` (${vital.system.split("/").pop()})` : ""}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/40 backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Pill className="h-4 w-4 text-primary" />
                    Diagnoses & medications
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-sm">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Diagnoses
                    </p>
                    {loading ? (
                      <p className="text-xs text-muted-foreground">Loading diagnoses...</p>
                    ) : !details || details.conditions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No recorded conditions for this patient.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        {details.conditions.slice(0, 5).map((cond) => (
                          <li key={cond.id}>
                            <span className="font-medium text-foreground">{cond.description}</span>
                            {cond.code && cond.system && (
                              <span className="ml-1 text-[11px] text-muted-foreground">
                                {cond.system.includes("icd-10") ? (
                                  <> (ICD-10: {cond.code})</>
                                ) : (
                                  <> ({cond.code}{cond.system ? ` · ${cond.system.split("/").pop()}` : ""})</>
                                )}
                              </span>
                            )}
                            {cond.onsetDate && (
                              <div className="text-[11px]">
                                Onset: {formatDate(cond.onsetDate)}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Medications
                    </p>
                    {loading ? (
                      <p className="text-xs text-muted-foreground">Loading medications...</p>
                    ) : !details || details.medications.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No active medication requests found.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        {details.medications.slice(0, 5).map((med) => (
                          <li key={med.id}>
                            <span className="font-medium text-foreground">{med.medication}</span>
                            {med.code && (
                              <span className="ml-1 text-[11px] text-muted-foreground">
                                ({med.code}
                                {med.system ? ` · ${med.system.split("/").pop()}` : ""})
                              </span>
                            )}
                            <div className="text-[11px]">
                              {med.intent && (
                                <span>
                                  Intent:{" "}
                                  <span className="font-medium text-foreground">
                                    {med.intent}
                                  </span>
                                </span>
                              )}
                              {med.status && (
                                <span className="ml-2">
                                  Status:{" "}
                                  <span className="font-medium text-foreground">
                                    {med.status}
                                  </span>
                                </span>
                              )}
                            </div>
                            {med.authoredOn && (
                              <div className="text-[11px]">
                                Authored: {formatDate(med.authoredOn)}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

