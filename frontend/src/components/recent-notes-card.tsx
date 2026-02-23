"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, ChevronRight, CheckCircle2 } from "lucide-react"
import { getDocuments, type DocumentSummary } from "@/lib/fhir"

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "Unknown date"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function RecentNotesCard() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const docs = await getDocuments()
        setDocuments(docs.slice(0, 5))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load notes")
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent Notes</h2>
            <p className="text-sm text-muted-foreground">Clinical documents on file</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:bg-primary/10 hover:text-primary"
        >
          View All
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clinical documents on file yet. Notes and documents will appear here.
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="group cursor-pointer rounded-xl bg-muted/30 p-4 transition-all duration-200 hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{doc.subject}</p>
                    <span className="text-border">•</span>
                    <span className="text-sm text-muted-foreground">{doc.type}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                    {doc.type} — {doc.subject}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-400/10">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    On file
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(doc.created)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
