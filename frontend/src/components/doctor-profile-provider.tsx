"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { DoctorProfile } from "@/lib/doctor-profile"
import { DEFAULT_DOCTOR_PROFILE, loadDoctorProfile, saveDoctorProfile } from "@/lib/doctor-profile"

type DoctorProfileContextValue = {
  profile: DoctorProfile
  setProfile: (next: DoctorProfile) => void
  updateProfile: (partial: Partial<DoctorProfile>) => void
}

const DoctorProfileContext = createContext<DoctorProfileContextValue | null>(null)

export function DoctorProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<DoctorProfile>(DEFAULT_DOCTOR_PROFILE)

  useEffect(() => {
    setProfileState(loadDoctorProfile())
  }, [])

  const setProfile = useCallback((next: DoctorProfile) => {
    setProfileState(next)
    saveDoctorProfile(next)
  }, [])

  const updateProfile = useCallback(
    (partial: Partial<DoctorProfile>) => {
      setProfileState((prev) => {
        const next = { ...prev, ...partial }
        saveDoctorProfile(next)
        return next
      })
    },
    []
  )

  const value = useMemo(() => ({ profile, setProfile, updateProfile }), [profile, setProfile, updateProfile])

  return <DoctorProfileContext.Provider value={value}>{children}</DoctorProfileContext.Provider>
}

export function useDoctorProfile(): DoctorProfileContextValue {
  const ctx = useContext(DoctorProfileContext)
  if (!ctx) {
    throw new Error("useDoctorProfile must be used within DoctorProfileProvider")
  }
  return ctx
}

