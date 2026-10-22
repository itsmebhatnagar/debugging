"use client"

import { useActionState, useState } from "react"
import { registerUser as register } from "@/app/actions/auth"
import Link from "next/link"

export default function RegisterPage() {
  const [errorMessage, dispatch, isPending] = useActionState(register, undefined)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [focused, setFocused] = useState<string | null>(null)

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 z-10 pt-20 pb-12" style={{ background: "#040302" }}>
      {/* Background World Texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'url("/login-bg.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.35,
      }} />

      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 55% 55% at 50% 50%, transparent 0%, rgba(4,3,2,0.4) 55%, rgba(4,3,2,0.85) 100%),
          linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%)
        `,
      }} />

      {/* Main Wood & Brass Frame Card */}
      <div className="relative w-full max-w-xl z-20 rounded-md p-8 md:p-10 shadow-2xl" style={{
        background: "linear-gradient(180deg, #1A0D08 0%, #120805 100%)",
        border: "2px solid #C7A04A",
        boxShadow: "0 12px 35px rgba(0,0,0,0.9), inset 0 0 40px rgba(0,0,0,0.8)",
      }}>
        {/* Corner Rivets */}
        <div style={{ position: "absolute", top: "8px", left: "8px", width: "6px", height: "6px", borderRadius: "50%", background: "#C7A04A", boxShadow: "0 0 5px rgba(199,160,74,0.6)" }} />
        <div style={{ position: "absolute", top: "8px", right: "8px", width: "6px", height: "6px", borderRadius: "50%", background: "#C7A04A", boxShadow: "0 0 5px rgba(199,160,74,0.6)" }} />
        <div style={{ position: "absolute", bottom: "8px", left: "8px", width: "6px", height: "6px", borderRadius: "50%", background: "#C7A04A", boxShadow: "0 0 5px rgba(199,160,74,0.6)" }} />
        <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "6px", height: "6px", borderRadius: "50%", background: "#C7A04A", boxShadow: "0 0 5px rgba(199,160,74,0.6)" }} />

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-[0.15em] mb-2" style={{
            fontFamily: '"Cinzel Decorative", serif',
            color: "#F4E7C7",
            textShadow: "0 2px 4px rgba(0,0,0,0.9)",
          }}>
            ENLIST IN THE CREW
          </h1>
          <div className="flex items-center justify-center gap-2 mb-2 opacity-80">
            <span className="w-10 h-[1px] bg-[#C7A04A]"></span>
            <span className="text-[#C7A04A] text-xs">⚔</span>
            <span className="w-10 h-[1px] bg-[#C7A04A]"></span>
          </div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{
            fontFamily: '"Cinzel", serif',
            color: "#D8B982",
          }}>
            Sign the Articles & Prepare to Sail
          </p>
        </div>

        {/* Form */}
        <form action={dispatch} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#D8B982]" style={{ fontFamily: '"Cinzel", serif' }} htmlFor="name">
                Pirate Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                placeholder="Jack Rackham"
                className="w-full rounded px-4 py-3 text-sm text-[#F4E7C7] placeholder-[#6B4F30] focus:outline-none transition-all"
                style={{
                  background: "linear-gradient(to bottom, #150A04, #1E120A)",
                  border: `1.5px solid ${focused === "name" ? "#E4C76A" : "#8B5E34"}`,
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#D8B982]" style={{ fontFamily: '"Cinzel", serif' }} htmlFor="email">
                Email Dispatch
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="captain@echona.com"
                className="w-full rounded px-4 py-3 text-sm text-[#F4E7C7] placeholder-[#6B4F30] focus:outline-none transition-all"
                style={{
                  background: "linear-gradient(to bottom, #150A04, #1E120A)",
                  border: `1.5px solid ${focused === "email" ? "#E4C76A" : "#8B5E34"}`,
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#D8B982]" style={{ fontFamily: '"Cinzel", serif' }} htmlFor="mobile">
                Pigeon Mobile Number
              </label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onFocus={() => setFocused("mobile")}
                onBlur={() => setFocused(null)}
                placeholder="+1 555-0199"
                className="w-full rounded px-4 py-3 text-sm text-[#F4E7C7] placeholder-[#6B4F30] focus:outline-none transition-all"
                style={{
                  background: "linear-gradient(to bottom, #150A04, #1E120A)",
                  border: `1.5px solid ${focused === "mobile" ? "#E4C76A" : "#8B5E34"}`,
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-[#D8B982]" style={{ fontFamily: '"Cinzel", serif' }} htmlFor="password">
                Secret Passcode
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                className="w-full rounded px-4 py-3 text-sm text-[#F4E7C7] placeholder-[#6B4F30] focus:outline-none transition-all"
                style={{
                  background: "linear-gradient(to bottom, #150A04, #1E120A)",
                  border: `1.5px solid ${focused === "pass" ? "#E4C76A" : "#8B5E34"}`,
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#D8B982]" style={{ fontFamily: '"Cinzel", serif' }} htmlFor="inviteCode">
              Crew Invite Scroll (Optional)
            </label>
            <input
              id="inviteCode"
              name="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onFocus={() => setFocused("invite")}
              onBlur={() => setFocused(null)}
              placeholder="TREASURE-2026"
              className="w-full rounded px-4 py-3 text-sm text-[#F4E7C7] placeholder-[#6B4F30] focus:outline-none transition-all uppercase"
              style={{
                background: "linear-gradient(to bottom, #150A04, #1E120A)",
                border: `1.5px solid ${focused === "invite" ? "#E4C76A" : "#8B5E34"}`,
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
              }}
            />
          </div>

          {errorMessage && (
            <div className="rounded border border-[#7A1F1F] bg-[#7A1F1F]/20 p-3 text-xs text-[#F4E7C7] text-center" style={{ fontFamily: '"Cinzel", serif' }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full relative mt-4 py-4 rounded font-bold uppercase tracking-[0.2em] text-xs transition-all shadow-xl"
            style={{
              fontFamily: '"Cinzel", serif',
              color: "#F4E7C7",
              background: "linear-gradient(to bottom, #741714, #2B1710)",
              border: "1px solid #C7A04A",
              boxShadow: "0 6px 15px rgba(0,0,0,0.6)",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "SIGNING ARTICLES..." : "SWEAR THE OATH & JOIN"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-[#D8B982]/80" style={{ fontFamily: '"Cinzel", serif' }}>
            Already sworn in?{" "}
            <Link href="/login" className="font-bold text-[#E2C36A] hover:underline">
              Return to the Ship
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
