"use client"

import { FormEvent, useState } from "react"

export function ResetPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [sealed, setSealed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/resetpassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const result = await response.json()

      if (response.status === 410) {
        setSealed(true)
      } else if (!response.ok) {
        setError(result.error || "Unable to reset the password.")
      } else {
        setSealed(true)
      }
    } catch {
      setError("A network error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#040302] px-4 text-[#d4cbb3]">
      <section className="w-full max-w-md rounded-lg border border-[#8b7355] bg-[#17130f] p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-widest text-[#d4af37]">
          ADMIN PASSWORD RESET
        </h1>
        {sealed ? (
          <p role="status" className="text-center leading-7">
            Password is changed and sealed; you cannot reset it again from this route.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm">Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded border border-[#8b7355] bg-black/40 px-3 py-2 outline-none focus:border-[#d4af37]"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm">New password (at least 12 characters)</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded border border-[#8b7355] bg-black/40 px-3 py-2 outline-none focus:border-[#d4af37]"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded border border-[#8b7355] bg-black/40 px-3 py-2 outline-none focus:border-[#d4af37]"
              />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded border border-[#d4af37] bg-[#d4af37] px-4 py-3 font-bold text-[#1a1714] transition-colors hover:bg-[#f0cf58] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "RESETTING..." : "RESET PASSWORD"}
            </button>
            <p className="text-center text-xs text-[#8b7355]">
              This route can successfully reset the admin password only once.
            </p>
          </form>
        )}
      </section>
    </main>
  )
}
