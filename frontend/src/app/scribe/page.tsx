"use client"

import { useState, useEffect, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Mic,
  Square,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Activity,
  Send,
  Stethoscope,
  Pill,
  FlaskConical,
  Volume2,
} from "lucide-react"
import {
  initializeScribeSession,
  extractClinicalData,
  validateClinicalData,
  mapToFHIRResources,
  getScribeSession,
  commitScribeSession,
  getPatients,
  type ScribeSession,
  type ExtractedClinicalData,
  type ValidationResult,
  type FHIRPatient,
} from "@/lib/fhir"

type WaypointStatus = "idle" | "active" | "complete" | "error"

type Waypoint = {
  id: string
  title: string
  description: string
  status: WaypointStatus
  icon: typeof Mic
}

export default function ScriberPage() {
  const [patientId, setPatientId] = useState("")
  const [patients, setPatients] = useState<FHIRPatient[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [session, setSession] = useState<ScribeSession | null>(null)
  const [transcript, setTranscript] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [extractedData, setExtractedData] = useState<ExtractedClinicalData | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [fhirResources, setFhirResources] = useState<unknown[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<number | null>(null)

  // Load patients on mount
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const data = await getPatients()
        setPatients(data)
      } catch (err) {
        console.error("Failed to load patients:", err)
      } finally {
        setLoadingPatients(false)
      }
    }
    fetchPatients()
  }, [])

  const waypoints: Waypoint[] = [
    {
      id: "capture",
      title: "Capture",
      description: "Record audio stream",
      status: session && !extractedData ? "active" : session ? "complete" : "idle",
      icon: Mic,
    },
    {
      id: "extract",
      title: "Extract",
      description: "Parse clinical data",
      status: extractedData && !validation ? "active" : extractedData ? "complete" : "idle",
      icon: Search,
    },
    {
      id: "validate",
      title: "Validate",
      description: "Check FHIR codes",
      status: validation && !fhirResources ? "active" : validation ? "complete" : "idle",
      icon: CheckCircle2,
    },
    {
      id: "map",
      title: "Map",
      description: "Create FHIR resources",
      status: fhirResources && session?.status !== "committed" ? "active" : fhirResources && session?.status === "committed" ? "complete" : "idle",
      icon: Activity,
    },
    {
      id: "review",
      title: "Review",
      description: "Provider confirmation",
      status: fhirResources && session?.status !== "committed" ? "active" : session?.status === "committed" ? "complete" : "idle",
      icon: FileText,
    },
    {
      id: "commit",
      title: "Commit",
      description: "Send to FHIR server",
      status: session?.status === "committed" ? "complete" : "idle",
      icon: Send,
    },
  ]

  const handleStartSession = async () => {
    if (!patientId.trim()) {
      setError("Please select a patient")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const newSession = await initializeScribeSession(patientId)
      setSession(newSession)
      await startAudioRecording()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session")
    } finally {
      setLoading(false)
    }
  }

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Setup MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // Setup audio level monitoring
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyserRef.current = analyser
      analyser.fftSize = 256
      source.connect(analyser)

      // Monitor audio level
      const monitorAudioLevel = () => {
        if (!analyserRef.current) return
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(Math.min(100, average * 2))
        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel)
      }
      monitorAudioLevel()

      // Setup Web Speech API for transcription
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        const recognition = new SpeechRecognition()
        recognitionRef.current = recognition
        
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          let interimTranscript = ''
          let finalTranscript = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPiece + ' '
            } else {
              interimTranscript += transcriptPiece
            }
          }

          if (finalTranscript) {
            setTranscript((prev) => prev + finalTranscript)
          }
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          if (event.error === 'no-speech') {
            // Restart recognition if it stops due to silence
            setTimeout(() => {
              if (isRecording && recognitionRef.current) {
                recognitionRef.current.start()
              }
            }, 1000)
          }
        }

        recognition.onend = () => {
          // Auto-restart recognition if still recording
          if (isRecording && recognitionRef.current) {
            recognitionRef.current.start()
          }
        }

        recognition.start()
      }

      mediaRecorder.start(1000) // Capture data every second
      setIsRecording(true)
      
      // Start duration timer
      setRecordingDuration(0)
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access microphone")
      throw err
    }
  }

  const handleStopRecording = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    setIsRecording(false)
    setIsPaused(false)
    setAudioLevel(0)
  }

  const handlePauseResume = () => {
    if (isPaused) {
      // Resume
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume()
      }
      if (recognitionRef.current) {
        recognitionRef.current.start()
      }
      if (durationIntervalRef.current === null) {
        durationIntervalRef.current = window.setInterval(() => {
          setRecordingDuration((prev) => prev + 1)
        }, 1000)
      }
      setIsPaused(false)
    } else {
      // Pause
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
      setIsPaused(true)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleStopRecording()
    }
  }, [])

  const handleExtract = async () => {
    if (!session || !transcript.trim()) {
      setError("Please enter a transcript")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const extracted = await extractClinicalData(session.id, transcript)
      setExtractedData(extracted)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract data")
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    try {
      const validationResult = await validateClinicalData(session.id)
      setValidation(validationResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate data")
    } finally {
      setLoading(false)
    }
  }

  const handleMap = async () => {
    if (!session || !patientId) return

    setLoading(true)
    setError(null)
    try {
      const result = await mapToFHIRResources(session.id, patientId)
      setFhirResources(result.resources)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to map resources")
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    try {
      await commitScribeSession(session.id)
      const updatedSession = await getScribeSession(session.id)
      setSession(updatedSession)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit to FHIR server")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSession(null)
    setTranscript("")
    setExtractedData(null)
    setValidation(null)
    setFhirResources(null)
    setError(null)
    setIsRecording(false)
  }

  const getStatusColor = (status: WaypointStatus) => {
    switch (status) {
      case "active":
        return "bg-primary/20 text-primary border-primary/30"
      case "complete":
        return "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
      case "error":
        return "bg-destructive/20 text-destructive border-destructive/30"
      default:
        return "bg-muted/30 text-muted-foreground border-border/30"
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6 pl-8 pr-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Ambient Scribe</h1>
                <p className="text-muted-foreground mt-1">
                  Modular Waypoint Architecture: Capture → Extract → Validate → Map → Review → Commit
                </p>
              </div>
              {session && (
                <Button variant="outline" onClick={handleReset} className="border-border/50">
                  New Session
                </Button>
              )}
            </div>

            {/* Waypoint Progress */}
            <Card className="bg-card/50 backdrop-blur-xl border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Workflow Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {waypoints.map((waypoint, index) => {
                    const Icon = waypoint.icon
                    return (
                      <div key={waypoint.id} className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-2 min-w-[120px]">
                          <Badge className={`${getStatusColor(waypoint.status)} px-3 py-2 gap-2`}>
                            <Icon className="h-4 w-4" />
                            {waypoint.title}
                          </Badge>
                          <p className="text-xs text-muted-foreground text-center">{waypoint.description}</p>
                        </div>
                        {index < waypoints.length - 1 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* WAYPOINT 1: Capture */}
            {!session && (
              <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    Waypoint 1: Capture
                  </CardTitle>
                  <CardDescription>Initialize scribe session and record audio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Select Patient</Label>
                    {loadingPatients ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading patients...
                      </div>
                    ) : (
                      <Select value={patientId} onValueChange={setPatientId}>
                        <SelectTrigger className="bg-secondary/50 border-border/50">
                          <SelectValue placeholder="Choose a patient..." />
                        </SelectTrigger>
                        <SelectContent>
                          {patients.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No patients available
                            </SelectItem>
                          ) : (
                            patients.map((patient) => (
                              <SelectItem key={patient.id} value={patient.id}>
                                {patient.name} ({patient.id})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button onClick={handleStartSession} disabled={loading || !patientId} className="bg-primary hover:bg-primary/90 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    Start Session
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recording Interface */}
            {session && !extractedData && (
              <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isRecording && !isPaused ? (
                      <>
                        <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                        Recording in Progress
                      </>
                    ) : isPaused ? (
                      <>
                        <Square className="h-5 w-5 text-amber-500" />
                        Recording Paused
                      </>
                    ) : (
                      <>
                        <Square className="h-5 w-5 text-muted-foreground" />
                        Recording Stopped
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>Session ID: {session.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Audio Level & Duration */}
                  {isRecording && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Audio Level</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{formatDuration(recordingDuration)}</span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                        <div
                          className="h-full bg-primary transition-all duration-100"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {audioLevel > 10 ? "Capturing audio..." : "Waiting for audio input..."}
                      </p>
                    </div>
                  )}

                  {/* Live Transcript */}
                  <div className="space-y-2">
                    <Label htmlFor="transcript">Live Transcript</Label>
                    <Textarea
                      id="transcript"
                      placeholder="Transcription will appear here as you speak..."
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={12}
                      className="bg-secondary/50 border-border/50 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isRecording
                        ? "Speech recognition is active. Speak clearly for best results. You can also edit the transcript manually."
                        : "Recording stopped. You can edit the transcript before extracting clinical data."}
                    </p>
                  </div>

                  {/* Recording Controls */}
                  <div className="flex gap-3">
                    {isRecording && (
                      <>
                        <Button
                          onClick={handlePauseResume}
                          variant="outline"
                          className="gap-2 border-border/50"
                        >
                          {isPaused ? (
                            <>
                              <Mic className="h-4 w-4" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Square className="h-4 w-4" />
                              Pause
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleStopRecording}
                          variant="outline"
                          className="gap-2 border-border/50"
                        >
                          <Square className="h-4 w-4" />
                          Stop Recording
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={handleExtract}
                      disabled={loading || !transcript.trim()}
                      className="bg-primary hover:bg-primary/90 gap-2"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Extract Clinical Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* WAYPOINT 2: Extract */}
            {extractedData && !validation && (
              <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Waypoint 2: Extracted Clinical Data
                  </CardTitle>
                  <CardDescription>Parsed findings from transcript using clinical LLM patterns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extractedData.chiefComplaint && (
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Chief Complaint</p>
                      <p className="text-sm text-foreground">{extractedData.chiefComplaint}</p>
                    </div>
                  )}

                  {extractedData.vitals.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Vitals ({extractedData.vitals.length})
                      </Label>
                      <div className="grid gap-2">
                        {extractedData.vitals.map((vital, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{vital.type}</p>
                              <p className="text-xs text-muted-foreground">LOINC: {vital.loincCode}</p>
                            </div>
                            <p className="text-sm font-medium">
                              {vital.systolic ? `${vital.systolic.value}/${vital.diastolic?.value} ${vital.systolic.unit}` : `${vital.value} ${vital.unit}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedData.diagnoses.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        Diagnoses ({extractedData.diagnoses.length})
                      </Label>
                      <div className="grid gap-2">
                        {extractedData.diagnoses.map((diagnosis, i) => (
                          <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                            <p className="text-sm font-medium text-foreground">{diagnosis.description}</p>
                            <p className="text-xs text-muted-foreground">{diagnosis.code || "No code"} · {diagnosis.system.split("/").pop()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedData.medications.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        Medications ({extractedData.medications.length})
                      </Label>
                      <div className="grid gap-2">
                        {extractedData.medications.map((med, i) => (
                          <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                            <p className="text-sm font-medium text-foreground">{med.name}</p>
                            <p className="text-xs text-muted-foreground">{med.code || "No RxNorm code"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedData.orders.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        Orders ({extractedData.orders.length})
                      </Label>
                      <div className="grid gap-2">
                        {extractedData.orders.map((order, i) => (
                          <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                            <p className="text-sm text-foreground">{order.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleValidate} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Validate Codes
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* WAYPOINT 3: Validate */}
            {validation && !fhirResources && (
              <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Waypoint 3: Validation Results
                  </CardTitle>
                  <CardDescription>Cross-referenced with ICD-10, LOINC, SNOMED, and RxNorm standards</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    {validation.valid ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        All codes valid
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Warnings found
                      </Badge>
                    )}
                  </div>

                  {validation.warnings.length > 0 && (
                    <div className="space-y-1">
                      {validation.warnings.map((warning, i) => (
                        <p key={i} className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  <Button onClick={handleMap} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    Map to FHIR Resources
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* WAYPOINT 4 & 5: Map & Review */}
            {fhirResources && session?.status !== "committed" && (
              <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Waypoint 4 & 5: Review FHIR Resources
                  </CardTitle>
                  <CardDescription>Human-in-the-loop: Review and confirm before committing to FHIR server</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground mb-2">{fhirResources.length} FHIR resources ready to commit</p>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {fhirResources.map((resource: any, i) => (
                        <div key={i} className="rounded border border-border/30 bg-background/50 p-2">
                          <p className="text-xs font-medium text-foreground">{resource.resourceType}</p>
                          <p className="text-xs text-muted-foreground font-mono">{JSON.stringify(resource, null, 2).substring(0, 200)}...</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    Review all resources before committing. This will create a Transaction Bundle and send it to the FHIR server.
                  </div>

                  <Button onClick={handleCommit} disabled={loading} className="bg-primary hover:bg-primary/90 gap-2 w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Commit to FHIR Server
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* WAYPOINT 6: Commit Success */}
            {session?.status === "committed" && (
              <Card className="bg-card/50 backdrop-blur-xl border-emerald-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 className="h-5 w-5" />
                    Waypoint 6: Committed Successfully
                  </CardTitle>
                  <CardDescription>Transaction Bundle submitted to FHIR server at http://localhost:8080/fhir</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <p className="font-medium">All resources committed successfully</p>
                      <p className="text-sm">Session ID: {session.id}</p>
                      <p className="text-sm">Committed at: {session.committedAt}</p>
                    </div>
                  </div>

                  <Button onClick={handleReset} className="bg-primary hover:bg-primary/90 w-full">
                    Start New Session
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
