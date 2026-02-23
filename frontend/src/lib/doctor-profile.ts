export type DoctorProfile = {
  firstName: string
  lastName: string
  email: string
  phone: string
  specialty: string
  timezone: string
  language: string
  /** National Provider Identifier (NPI) - 10-digit identifier for the provider */
  npi: string
  avatarUrl?: string
}

const STORAGE_KEY = "medscribe.doctorProfile.v1"

export const DEFAULT_DOCTOR_PROFILE: DoctorProfile = {
  firstName: "Sarah",
  lastName: "Mitchell",
  email: "dr.mitchell@medscribe.health",
  phone: "+1 (555) 234-5678",
  specialty: "Internal Medicine",
  timezone: "Eastern Time (EST)",
  language: "English (US)",
  npi: "",
  avatarUrl: "/doctor-avatar.jpg",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function getDoctorDisplayName(p: DoctorProfile): string {
  const full = `${p.firstName} ${p.lastName}`.trim()
  return full ? `Dr. ${full}` : "Dr."
}

export function getInitials(p: DoctorProfile): string {
  const a = (p.firstName || "").trim()[0] ?? ""
  const b = (p.lastName || "").trim()[0] ?? ""
  const initials = `${a}${b}`.toUpperCase()
  return initials || "DR"
}

export function loadDoctorProfile(): DoctorProfile {
  if (typeof window === "undefined") return DEFAULT_DOCTOR_PROFILE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DOCTOR_PROFILE
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return DEFAULT_DOCTOR_PROFILE

    // Merge so new fields get defaults.
    return {
      ...DEFAULT_DOCTOR_PROFILE,
      ...parsed,
    } as DoctorProfile
  } catch {
    return DEFAULT_DOCTOR_PROFILE
  }
}

export function saveDoctorProfile(profile: DoctorProfile): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

