"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useDoctorProfile } from "@/components/doctor-profile-provider"
import { getDoctorDisplayName, getInitials } from "@/lib/doctor-profile"
import { clearDriveLink, getDriveStatus, importDrivePatients, type DriveLinkStatus } from "@/lib/fhir"
import {
  User,
  Bell,
  Shield,
  Palette,
  Mic,
  CreditCard,
  Camera,
  Mail,
  Phone,
  Building2,
  Clock,
  Globe,
  Volume2,
  FileText,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Link2,
  Unlink,
} from "lucide-react"

export default function SettingsPage() {
  const { profile, setProfile } = useDoctorProfile()
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [driveStatus, setDriveStatus] = useState<DriveLinkStatus | null>(null)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null)

  const [notifications, setNotifications] = useState({
    appointments: true,
    scribeComplete: true,
    patientMessages: false,
    systemUpdates: true,
    emailDigest: false,
  })

  const [scribeSettings, setScribeSettings] = useState({
    autoStart: false,
    backgroundNoise: true,
    speakerDiarization: true,
    medicalTerms: true,
  })

  const displayName = getDoctorDisplayName(draft)
  const initials = getInitials(draft)

  useEffect(() => {
    let active = true
    getDriveStatus()
      .then((status) => {
        if (active) {
          setDriveStatus(status)
        }
      })
      .catch((error) => {
        if (active) {
          setDriveError(error instanceof Error ? error.message : "Failed to load drive status")
        }
      })

    return () => {
      active = false
    }
  }, [])

  const handleDriveFolderSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    setDriveError(null)
    setDriveSuccess(null)

    if (files.length === 0) {
      return
    }

    setDriveLoading(true)
    try {
      const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"))
      if (jsonFiles.length === 0) {
        throw new Error("No JSON files found in the selected folder.")
      }

      const patients: unknown[] = []
      for (const file of jsonFiles) {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          patients.push(...parsed)
        } else if (parsed && typeof parsed === "object") {
          patients.push(parsed)
        }
      }

      const firstFile = files[0] as File & { webkitRelativePath?: string }
      const folderName = firstFile?.webkitRelativePath?.split("/")?.[0] || undefined
      const result = await importDrivePatients(patients, folderName)
      setDriveSuccess(
        `Linked ${result.count} patient${result.count === 1 ? "" : "s"}` +
          (result.folderName ? ` from ${result.folderName}` : "")
      )
      const status = await getDriveStatus()
      setDriveStatus(status)
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : "Failed to import drive patients")
    } finally {
      setDriveLoading(false)
      event.target.value = ""
    }
  }

  const handleClearDriveLink = async () => {
    setDriveError(null)
    setDriveSuccess(null)
    setDriveLoading(true)
    try {
      await clearDriveLink()
      setDriveStatus({ linked: false, folderName: null, updatedAt: null, count: 0 })
      setDriveSuccess("Drive link cleared")
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : "Failed to clear drive link")
    } finally {
      setDriveLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your account and application preferences</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="bg-secondary/50 backdrop-blur-sm border border-border/50 p-1">
                <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="notifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <Bell className="h-4 w-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="scribe" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <Mic className="h-4 w-4" />
                  Scribe
                </TabsTrigger>
                <TabsTrigger value="security" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <Shield className="h-4 w-4" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Personal Contact Information
                      </CardTitle>
                      <CardDescription>View and manage your contact details</CardDescription>
                    </div>
                    {!isEditingPersonal && (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingPersonal(true)}
                        className="border-border/50 hover:bg-secondary/50"
                      >
                        Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isEditingPersonal ? (
                      <>
                        {/* Edit Mode Content */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              value={draft.firstName}
                              onChange={(e) => {
                                setDraft((p) => ({ ...p, firstName: e.target.value }))
                              }}
                              className="bg-secondary/50 border-border/50 focus:ring-primary"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              value={draft.lastName}
                              onChange={(e) => {
                                setDraft((p) => ({ ...p, lastName: e.target.value }))
                              }}
                              className="bg-secondary/50 border-border/50 focus:ring-primary"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              Email Address
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              value={draft.email}
                              onChange={(e) => {
                                setDraft((p) => ({ ...p, email: e.target.value }))
                              }}
                              className="bg-secondary/50 border-border/50 focus:ring-primary"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              Phone Number
                            </Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={draft.phone}
                              onChange={(e) => {
                                setDraft((p) => ({ ...p, phone: e.target.value }))
                              }}
                              className="bg-secondary/50 border-border/50 focus:ring-primary"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="npi" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            NPI Number (National Provider Identifier)
                          </Label>
                          <Input
                            id="npi"
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="10-digit NPI"
                            value={draft.npi ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                              setDraft((p) => ({ ...p, npi: v }))
                            }}
                            className="bg-secondary/50 border-border/50 focus:ring-primary max-w-[200px]"
                          />
                          <p className="text-xs text-muted-foreground">10-digit identifier used for billing and provider identification.</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setDraft(profile)
                              setIsEditingPersonal(false)
                            }}
                            className="border-border/50 hover:bg-secondary/50"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="bg-primary hover:bg-primary/90"
                            onClick={() => {
                              setProfile(draft)
                              setIsEditingPersonal(false)
                              setSaved(true)
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* View Mode Content */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-foreground">First Name</Label>
                            <p className="text-foreground font-medium">{draft.firstName}</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-foreground">Last Name</Label>
                            <p className="text-foreground font-medium">{draft.lastName}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-foreground">NPI Number</Label>
                            <p className="text-foreground font-medium">{draft.npi ? draft.npi : "—"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              Email Address
                            </Label>
                            <p className="text-foreground font-medium">{draft.email}</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              Phone Number
                            </Label>
                            <p className="text-foreground font-medium">{draft.phone}</p>
                          </div>
                        </div>

                        {saved && (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">Changes saved successfully</span>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Other Profile Settings */}
                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Professional Information
                    </CardTitle>
                    <CardDescription>Update your professional details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar className="h-24 w-24 border-2 border-primary/20">
                          <AvatarImage src={draft.avatarUrl || "/placeholder.svg"} alt={displayName} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xl">{initials}</AvatarFallback>
                        </Avatar>
                        <Button
                          size="icon"
                          className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
                          type="button"
                          onClick={() => {
                            // TODO: wire up file upload; for now keep existing URL
                            setSaved(false)
                          }}
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">Profile Photo</h3>
                        <p className="text-sm text-muted-foreground mt-1">JPG, PNG or GIF. Max size 2MB.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="specialty" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        Medical Specialty
                      </Label>
                      <Select
                        value={draft.specialty}
                        onValueChange={(value) => {
                          setDraft((p) => ({ ...p, specialty: value }))
                          setSaved(false)
                        }}
                      >
                        <SelectTrigger className="bg-secondary/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
                          <SelectItem value="Family Medicine">Family Medicine</SelectItem>
                          <SelectItem value="Cardiology">Cardiology</SelectItem>
                          <SelectItem value="Neurology">Neurology</SelectItem>
                          <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                          <SelectItem value="Psychiatry">Psychiatry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="timezone" className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Timezone
                        </Label>
                        <Select
                          value={draft.timezone}
                          onValueChange={(value) => {
                            setDraft((p) => ({ ...p, timezone: value }))
                            setSaved(false)
                          }}
                        >
                          <SelectTrigger className="bg-secondary/50 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Eastern Time (EST)">Eastern Time (EST)</SelectItem>
                            <SelectItem value="Central Time (CST)">Central Time (CST)</SelectItem>
                            <SelectItem value="Mountain Time (MST)">Mountain Time (MST)</SelectItem>
                            <SelectItem value="Pacific Time (PST)">Pacific Time (PST)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="language" className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          Language
                        </Label>
                        <Select
                          value={draft.language}
                          onValueChange={(value) => {
                            setDraft((p) => ({ ...p, language: value }))
                            setSaved(false)
                          }}
                        >
                          <SelectTrigger className="bg-secondary/50 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="English (US)">English (US)</SelectItem>
                            <SelectItem value="Spanish">Spanish</SelectItem>
                            <SelectItem value="French">French</SelectItem>
                            <SelectItem value="German">German</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        {saved ? <span className="text-sm text-muted-foreground">Saved</span> : null}
                        <Button
                          type="button"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setProfile(draft)
                            setSaved(true)
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      Linked Drive Folder
                    </CardTitle>
                    <CardDescription>
                      Link a folder of JSON patient files and display them in the patient list.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Status</p>
                          <p className="text-sm text-muted-foreground">
                            {driveStatus?.linked
                              ? `Linked${driveStatus.folderName ? ` to ${driveStatus.folderName}` : ""}`
                              : "Not linked"}
                          </p>
                          {driveStatus?.linked ? (
                            <p className="text-xs text-muted-foreground">
                              {driveStatus.count} patient{driveStatus.count === 1 ? "" : "s"} · Updated {driveStatus.updatedAt}
                            </p>
                          ) : null}
                        </div>
                        <Badge className={driveStatus?.linked ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"}>
                          {driveStatus?.linked ? "Linked" : "Not linked"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        Select a folder
                      </Label>
                      <input
                        type="file"
                        multiple
                        className="block w-full rounded-md border border-border/50 bg-secondary/50 px-3 py-2 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                        onChange={handleDriveFolderSelect}
                        disabled={driveLoading}
                        // @ts-expect-error - non-standard attribute to allow folder selection in Chromium
                        webkitdirectory="true"
                      />
                      <p className="text-xs text-muted-foreground">
                        Each JSON file should represent a single patient (or an array). Supported fields include id, name, gender,
                        birthDate, phone, email, address, visits, labs, vitals, conditions, medications.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={handleClearDriveLink}
                        disabled={driveLoading || !driveStatus?.linked}
                        className="border-border/50 hover:bg-secondary/50"
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        Unlink folder
                      </Button>
                    </div>

                    {driveError ? (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {driveError}
                      </div>
                    ) : null}

                    {driveSuccess ? (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {driveSuccess}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Notification Preferences
                    </CardTitle>
                    <CardDescription>Choose what notifications you want to receive</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Appointment Reminders</p>
                            <p className="text-sm text-muted-foreground">Get notified 15 minutes before appointments</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifications.appointments}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, appointments: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Scribe Completion</p>
                            <p className="text-sm text-muted-foreground">Notify when AI transcription is ready for review</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifications.scribeComplete}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, scribeComplete: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Patient Messages</p>
                            <p className="text-sm text-muted-foreground">Receive alerts for new patient messages</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifications.patientMessages}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, patientMessages: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">System Updates</p>
                            <p className="text-sm text-muted-foreground">Important platform updates and maintenance alerts</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifications.systemUpdates}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, systemUpdates: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Weekly Email Digest</p>
                            <p className="text-sm text-muted-foreground">Summary of your weekly activity and statistics</p>
                          </div>
                        </div>
                        <Switch
                          checked={notifications.emailDigest}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, emailDigest: checked })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Scribe Tab */}
              <TabsContent value="scribe" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mic className="h-5 w-5 text-primary" />
                      Ambient Scribe Settings
                    </CardTitle>
                    <CardDescription>Configure your AI transcription preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mic className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Auto-Start Recording</p>
                            <p className="text-sm text-muted-foreground">Automatically begin recording when appointment starts</p>
                          </div>
                        </div>
                        <Switch
                          checked={scribeSettings.autoStart}
                          onCheckedChange={(checked) => setScribeSettings({ ...scribeSettings, autoStart: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Volume2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Background Noise Reduction</p>
                            <p className="text-sm text-muted-foreground">Filter ambient noise for clearer transcription</p>
                          </div>
                        </div>
                        <Switch
                          checked={scribeSettings.backgroundNoise}
                          onCheckedChange={(checked) => setScribeSettings({ ...scribeSettings, backgroundNoise: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Speaker Diarization</p>
                            <p className="text-sm text-muted-foreground">Distinguish between doctor and patient voices</p>
                          </div>
                        </div>
                        <Switch
                          checked={scribeSettings.speakerDiarization}
                          onCheckedChange={(checked) => setScribeSettings({ ...scribeSettings, speakerDiarization: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Medical Terminology Enhancement</p>
                            <p className="text-sm text-muted-foreground">Improve accuracy for medical terms and drug names</p>
                          </div>
                        </div>
                        <Switch
                          checked={scribeSettings.medicalTerms}
                          onCheckedChange={(checked) => setScribeSettings({ ...scribeSettings, medicalTerms: checked })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Note Template</Label>
                      <Select defaultValue="soap">
                        <SelectTrigger className="bg-secondary/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="soap">SOAP Note</SelectItem>
                          <SelectItem value="hpi">History of Present Illness</SelectItem>
                          <SelectItem value="progress">Progress Note</SelectItem>
                          <SelectItem value="consult">Consultation Note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Preferred EHR Integration</Label>
                      <Select defaultValue="epic">
                        <SelectTrigger className="bg-secondary/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="epic">Epic Systems</SelectItem>
                          <SelectItem value="cerner">Cerner</SelectItem>
                          <SelectItem value="allscripts">Allscripts</SelectItem>
                          <SelectItem value="athena">athenahealth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Security Settings
                    </CardTitle>
                    <CardDescription>Manage your account security and authentication</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">Password</p>
                            <p className="text-sm text-muted-foreground">Last changed 30 days ago</p>
                          </div>
                          <Button variant="outline" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                            Change Password
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-chart-4/20 flex items-center justify-center">
                              <CheckCircle2 className="h-5 w-5 text-chart-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">Two-Factor Authentication</p>
                              <p className="text-sm text-muted-foreground">Enabled via Authenticator App</p>
                            </div>
                          </div>
                          <Badge className="bg-chart-4/20 text-chart-4 border-0">Active</Badge>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">Active Sessions</p>
                            <p className="text-sm text-muted-foreground">2 devices currently logged in</p>
                          </div>
                          <Button variant="outline" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                            Manage Sessions
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">Login History</p>
                            <p className="text-sm text-muted-foreground">View recent account activity</p>
                          </div>
                          <Button variant="outline" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                            View History
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>Irreversible account actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">Delete Account</p>
                          <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                        </div>
                        <Button variant="destructive">Delete Account</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Billing Tab */}
              <TabsContent value="billing" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Subscription Plan
                    </CardTitle>
                    <CardDescription>Manage your subscription and billing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-6 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge className="bg-primary text-primary-foreground mb-2">Pro Plan</Badge>
                          <h3 className="text-2xl font-semibold text-foreground">$199/month</h3>
                          <p className="text-sm text-muted-foreground mt-1">Unlimited scribe sessions and priority support</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Next billing date</p>
                          <p className="font-medium text-foreground">February 18, 2026</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 text-center">
                        <p className="text-2xl font-semibold text-foreground">247</p>
                        <p className="text-sm text-muted-foreground">Sessions this month</p>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 text-center">
                        <p className="text-2xl font-semibold text-foreground">1,847</p>
                        <p className="text-sm text-muted-foreground">Notes generated</p>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 text-center">
                        <p className="text-2xl font-semibold text-foreground">156h</p>
                        <p className="text-sm text-muted-foreground">Time saved</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">Payment Method</h4>
                      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-14 rounded bg-secondary flex items-center justify-center">
                            <span className="text-xs font-bold text-muted-foreground">VISA</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Visa ending in 4242</p>
                            <p className="text-sm text-muted-foreground">Expires 12/2027</p>
                          </div>
                        </div>
                        <Button variant="outline" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                          Update
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border/50">
                      <Button variant="outline" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                        View Invoices
                      </Button>
                      <Button variant="outline" className="border-border/50 hover:bg-secondary/50 bg-transparent">
                        Change Plan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
