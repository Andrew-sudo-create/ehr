"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CreditCard, Plus, Building2, Hash, DollarSign } from "lucide-react"

export type BillingStatus = "active" | "pending" | "inactive"

export interface BillingEntry {
  id: string
  payerName: string
  payerId: string
  memberId: string
  groupNumber: string
  status: BillingStatus
  copay: string
  deductible: string
  outOfPocketMax: string
}

const statusConfig: Record<BillingStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground ring-border",
  },
}

const defaultEntries: BillingEntry[] = [
  {
    id: "1",
    payerName: "BlueCross BlueShield",
    payerId: "BCBS-001",
    memberId: "MEM-88291",
    groupNumber: "GRP-44521",
    status: "active",
    copay: "$25",
    deductible: "$500",
    outOfPocketMax: "$3,000",
  },
  {
    id: "2",
    payerName: "Aetna",
    payerId: "AETNA-882",
    memberId: "MEM-33456",
    groupNumber: "GRP-77890",
    status: "pending",
    copay: "$30",
    deductible: "$750",
    outOfPocketMax: "$4,500",
  },
  {
    id: "3",
    payerName: "UnitedHealthcare",
    payerId: "UHC-1122",
    memberId: "MEM-99812",
    groupNumber: "GRP-22334",
    status: "inactive",
    copay: "$20",
    deductible: "$1,000",
    outOfPocketMax: "$5,000",
  },
]

const emptyEntry: Omit<BillingEntry, "id"> = {
  payerName: "",
  payerId: "",
  memberId: "",
  groupNumber: "",
  status: "active",
  copay: "",
  deductible: "",
  outOfPocketMax: "",
}

export default function BillingPage() {
  const [entries, setEntries] = useState<BillingEntry[]>(defaultEntries)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<BillingEntry, "id">>(emptyEntry)

  const handleAdd = () => {
    if (!form.payerName.trim()) return
    setEntries((prev) => [
      ...prev,
      {
        ...form,
        id: String(Date.now()),
      },
    ])
    setForm(emptyEntry)
    setOpen(false)
  }

  const handleRemove = (id: string) => {
    if (window.confirm("Remove this billing entry?")) {
      setEntries((prev) => prev.filter((e) => e.id !== id))
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 pl-[72px] lg:pl-[240px]">
        <Header />
        <main className="p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Payer details, member/group IDs, and financial breakdown
              </p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Add payer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg rounded-2xl border-border/50">
                <DialogHeader>
                  <DialogTitle>Add billing entry</DialogTitle>
                  <DialogDescription>
                    Add payer details, member/group numbers for portal login, and financial breakdown.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">Payer details</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="payerName">Payer name</Label>
                        <Input
                          id="payerName"
                          placeholder="e.g. BlueCross BlueShield"
                          value={form.payerName}
                          onChange={(e) => setForm((f) => ({ ...f, payerName: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="payerId">Payer ID</Label>
                        <Input
                          id="payerId"
                          placeholder="e.g. BCBS-001"
                          value={form.payerId}
                          onChange={(e) => setForm((f) => ({ ...f, payerId: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">Member ID & group number</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="memberId">Member ID</Label>
                        <Input
                          id="memberId"
                          placeholder="For portal login"
                          value={form.memberId}
                          onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="groupNumber">Group number</Label>
                        <Input
                          id="groupNumber"
                          placeholder="For portal login"
                          value={form.groupNumber}
                          onChange={(e) => setForm((f) => ({ ...f, groupNumber: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BillingStatus }))}
                      className="flex h-10 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">Financial breakdown</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="copay">Copay</Label>
                        <Input
                          id="copay"
                          placeholder="$25"
                          value={form.copay}
                          onChange={(e) => setForm((f) => ({ ...f, copay: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="deductible">Deductible</Label>
                        <Input
                          id="deductible"
                          placeholder="$500"
                          value={form.deductible}
                          onChange={(e) => setForm((f) => ({ ...f, deductible: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="oop">Out-of-pocket max</Label>
                        <Input
                          id="oop"
                          placeholder="$3,000"
                          value={form.outOfPocketMax}
                          onChange={(e) => setForm((f) => ({ ...f, outOfPocketMax: e.target.value }))}
                          className="rounded-lg border-border/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
                    Cancel
                  </Button>
                  <Button onClick={handleAdd} className="rounded-lg bg-primary hover:bg-primary/90">
                    Add entry
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => {
              const status = statusConfig[entry.status]
              return (
                <Card
                  key={entry.id}
                  className="border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden"
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-medium">{entry.payerName || "Unnamed payer"}</CardTitle>
                        <p className="text-xs text-muted-foreground">Payer ID: {entry.payerId || "—"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 rounded-lg ring-1 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Hash className="h-3.5 w-3.5" />
                        Member ID & group number
                      </p>
                      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <p className="font-medium text-foreground">Member ID: {entry.memberId || "—"}</p>
                        <p className="mt-0.5 text-muted-foreground">Group: {entry.groupNumber || "—"}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Use these to log into payer portals.</p>
                    </div>
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" />
                        Financial breakdown
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Copay</p>
                          <p className="font-medium text-foreground">{entry.copay || "—"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Deductible</p>
                          <p className="font-medium text-foreground">{entry.deductible || "—"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">OOP max</p>
                          <p className="font-medium text-foreground">{entry.outOfPocketMax || "—"}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemove(entry.id)}
                    >
                      Remove entry
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {entries.length === 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm font-medium text-foreground">No billing entries yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a payer to manage payer details, member/group IDs, and financial breakdown.
                </p>
                <Button
                  className="mt-4 gap-2 rounded-xl bg-primary hover:bg-primary/90"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add payer
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
