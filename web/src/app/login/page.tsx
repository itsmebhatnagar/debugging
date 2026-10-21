"use client"

import { useActionState, useState } from "react"
import { authenticate } from "@/app/actions/auth"
import Link from "next/link"

export default function LoginPage() {
  const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <div className="auth-screen relative z-10 flex flex-col items-center justify-center">
      
      <div className="auth-card relative w-full max-w-md overflow-hidden rounded-[2rem] bg-[#d4af37]/20 p-[2px] shadow-2xl">
        <div className="auth-card-inner relative flex w-full flex-col items-center rounded-[2rem] border border-[#d4af37]/10 bg-[#1a1714]/85 p-8 backdrop-blur-md">
          
          {/* Header */}
          <div className="auth-heading mb-6 text-center">
            <div className="auth-icon mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d4af37]/50 bg-[#1a1714]/80 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            
            <h1 className="auth-title mt-3 font-cinzel font-bold tracking-[0.15em] text-[#f4ede0] drop-shadow-[0_0_10px_rgba(244,237,224,0.3)]">
              BOARD THE FLAGSHIP
            </h1>
            <p className="auth-subtitle mt-2 text-xs font-garamond font-semibold uppercase tracking-wide text-[#f4ede0]/70">
              Enter your credentials to access the Arena
            </p>
          </div>

          {/* ── Form ──────────────────────────────────────────── */}
          <form action={dispatch} className="auth-form w-full">
            <div className="space-y-2">
              <label className="block text-[10px] font-cinzel font-bold uppercase tracking-[0.15em] text-[#d4af37]" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="captain@echona.com"
                className="w-full bg-[#1a1714]/80 border border-[#d4af37]/30 rounded-lg px-4 py-3 text-sm font-garamond text-[#f4ede0] placeholder:text-[#f4ede0]/60 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-cinzel font-bold uppercase tracking-[0.15em] text-[#d4af37]" htmlFor="password">
                Passcode
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1a1714]/80 border border-[#d4af37]/30 rounded-lg px-4 py-3 text-sm font-garamond text-[#f4ede0] placeholder:text-[#f4ede0]/60 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
              />
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 p-3 text-xs font-garamond font-semibold text-[#ef4444] text-center">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="auth-submit mt-4 w-full rounded-xl border border-[#d4af37]/60 bg-[#1a1714]/80 py-4 text-xs font-cinzel font-bold uppercase tracking-[0.2em] text-[#d4af37] transition-colors hover:bg-[#d4af37]/20 disabled:border-[#d4af37]/20 disabled:bg-[#d4af37]/5 disabled:text-[#d4af37]/80"
            >
              {isPending ? "VERIFYING ORDERS..." : "SIGN IN & ENTER ARENA"}
            </button>
          </form>

          {/* Footer link */}
          <div className="auth-footer mt-8 text-center">
            <p className="text-xs font-garamond font-semibold text-[#f4ede0]/60">
              No pirate commission yet?{" "}
              <Link href="/register" className="font-bold text-[#d4af37] hover:text-[#f4ede0] transition-colors">
                Enlist in the crew
              </Link>
            </p>
          </div>
          
        </div>
      </div>
    </div>
  )
}
