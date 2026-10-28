"use client"

import React, { useState } from "react"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [toastError, setToastError] = useState("")
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isPending) return
    setIsPending(true)
    setToastError("")

    const form = e.currentTarget
    const emailEl = form.elements.namedItem("email") as HTMLInputElement | null
    const passEl = form.elements.namedItem("password") as HTMLInputElement | null

    const submittedEmail = (emailEl?.value || email || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()
    const submittedPassword = (passEl?.value || password || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()

    console.log("[Login] Submitting login for:", submittedEmail, "passLength:", submittedPassword.length)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.warn("[Login] Auth response failed:", data.error)
        setToastError(data.error || "Invalid email or password.")
        setTimeout(() => setToastError(""), 4500)
        setIsPending(false)
        return
      }

      if (data.token) {
        localStorage.setItem("admin_token", data.token)
        const isHttps = typeof window !== "undefined" && window.location.protocol === "https:"
        document.cookie =
          "admin_token=" +
          data.token +
          "; path=/; max-age=604800; SameSite=Lax" +
          (isHttps ? "; Secure" : "")
      }

      window.location.href = data.redirectTo || (data.role === "ADMIN" ? "/admin/dashboard" : "/dashboard")
    } catch (err) {
      console.error("[Login] Network/auth error:", err)
      setToastError("Network error. Please try again.")
      setTimeout(() => setToastError(""), 4500)
      setIsPending(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "#040302" }}>
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #1E120A inset !important;
          -webkit-text-fill-color: #F4E6C2 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      {/* ── Global Error Toast ── */}
      <div 
        className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 pointer-events-none flex items-center gap-3 ${toastError ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"}`}
        style={{
          background: "linear-gradient(to bottom, rgba(70, 10, 10, 0.95), rgba(40, 5, 5, 0.98))",
          border: "1px solid #C9A24A",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)",
          padding: "10px 24px",
          borderRadius: "6px",
        }}
      >
        <svg style={{ width: "20px", height: "20px", color: "#E4C76A" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span style={{
          color: "#F4E6C2",
          fontSize: "13px",
          fontFamily: '"Cinzel", serif',
          fontWeight: 700,
          letterSpacing: "0.1em",
          textShadow: "0 2px 4px rgba(0,0,0,0.8)"
        }}>
          {toastError}
        </span>
      </div>

      {/* ── BG Layer 1: Pirate World ── */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'url("/login-bg.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.38,
      }} />

      {/* ── BG Layer 2: Vignette + Radial Darkening ── */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 55% 55% at 50% 50%, transparent 0%, rgba(4,3,2,0.4) 55%, rgba(4,3,2,0.85) 100%),
          linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%)
        `,
      }} />

      {/* ── BG Layer 3: Contact shadow zone behind scroll ── */}
      <div className="absolute" style={{
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(50vw, 700px)",
        height: "min(60vh, 700px)",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Foreground: Wooden Scroll Container ── */}
      <div className="relative z-10" style={{
        height: "min(88vh, 920px)",
        width: "auto",
        maxWidth: "92vw",
        transform: "perspective(1400px) translateZ(18px)",
        filter: `
          drop-shadow(0 4px 6px rgba(0,0,0,0.55))
          drop-shadow(0 12px 18px rgba(0,0,0,0.45))
          drop-shadow(0 28px 45px rgba(0,0,0,0.35))
          drop-shadow(0 2px 8px rgba(0,0,0,0.3))
          drop-shadow(0 0 12px rgba(210,160,70,0.08))
        `,
      }}>
        {/* Warm light overlay on the scroll */}
        <div className="absolute inset-0 pointer-events-none rounded-none z-20" style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(255,220,150,0.06) 0%, transparent 70%)",
          mixBlendMode: "screen",
        }} />

        {/* The scroll image */}
        <img
          src="/woodenscrool.png"
          alt=""
          className="select-none pointer-events-none"
          draggable={false}
          style={{
            height: "100%",
            width: "auto",
            display: "block",
            objectFit: "contain",
            filter: "brightness(1.08) contrast(1.04)",
          }}
        />

        {/* ── Parchment Content Layer ── */}
        <div className="absolute flex flex-col items-center" style={{
          top: "14%",
          left: "14%",
          width: "72%",
          height: "72%",
          overflow: "hidden",
          display: "flex",
          justifyContent: "start",
          paddingTop: "clamp(10px, 2.2vw, 28px)",
          paddingBottom: "clamp(20px, 3.5vw, 44px)",
        }}>
          {/* Inner content group */}
          <div style={{
            width: "72%",
            maxWidth: "390px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}>

            {/* HEADER */}
            <div className="text-center w-full" style={{ marginBottom: "clamp(10px, 1.8vw, 22px)" }}>
              <h1 style={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: "clamp(14px, 2vw, 26px)",
                fontWeight: 700,
                color: "#3A200D",
                letterSpacing: "0.12em",
                textShadow: "0 1px 0 rgba(232,208,154,0.5), 0 -1px 0 rgba(0,0,0,0.1)",
                lineHeight: 1.1,
                margin: 0,
              }}>
                ECHONA
              </h1>
              <div className="flex items-center justify-center" style={{ gap: "6px", margin: "4px 0" }}>
                <div style={{ height: "1px", width: "28px", background: "linear-gradient(to right, transparent, #8C6D46, transparent)" }} />
                <svg width="8" height="8" viewBox="0 0 24 24" fill="#8C6D46" style={{ flexShrink: 0, opacity: 0.6 }}>
                  <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                </svg>
                <div style={{ height: "1px", width: "28px", background: "linear-gradient(to left, transparent, #8C6D46, transparent)" }} />
              </div>
              <p style={{
                fontFamily: '"Cinzel", serif',
                fontSize: "clamp(7px, 0.65vw, 10px)",
                fontWeight: 600,
                color: "#5C3A1E",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                margin: 0,
              }}>
                Pirates of Knowledge
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col relative" style={{ gap: "16px" }}>

              {/* CREW EMAIL / ID */}
              <div>
                <label htmlFor="email" style={{
                  display: "block",
                  fontFamily: '"Cinzel", serif',
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#4A2E15",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                  textShadow: "0 1px 0 rgba(232,208,154,0.3)",
                }}>
                  Crew ID / Email
                </label>
                <div className="relative" style={{
                  borderRadius: "5px",
                  background: "linear-gradient(to bottom, #150A04, #1E120A, #24140D)",
                  border: `1.5px solid ${focused === "email" ? "#E4C76A" : "#9A7B50"}`,
                  boxShadow: focused === "email"
                    ? "inset 0 3px 10px rgba(0,0,0,0.85), inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(232,208,154,0.08), 0 0 12px rgba(201,162,74,0.12)"
                    : "inset 0 3px 10px rgba(0,0,0,0.85), inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(232,208,154,0.08)",
                  transition: "border-color 250ms, box-shadow 250ms",
                  height: "44px",
                }}>
                  <div style={{
                    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", zIndex: 2,
                    color: focused === "email" ? "#E4C76A" : "#8C6D46", transition: "color 250ms",
                  }}>
                    <div style={{
                      width: "16px", height: "16px",
                      backgroundColor: "currentColor",
                      WebkitMaskImage: 'url("/crew.png")',
                      WebkitMaskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskImage: 'url("/crew.png")',
                      maskSize: "contain",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                    }} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    placeholder="captain@echona.com"
                    className="placeholder-[#6B4F30]"
                    style={{
                      width: "100%", height: "100%", background: "transparent", border: "none", outline: "none",
                      paddingLeft: "38px",
                      paddingRight: "14px",
                      fontFamily: '"Georgia", serif',
                      fontSize: "13px",
                      fontWeight: 400, color: "#F4E6C2", letterSpacing: "0.05em",
                    }}
                  />
                </div>
              </div>

              {/* SECRET PASSCODE */}
              <div>
                <label htmlFor="password" style={{
                  display: "block",
                  fontFamily: '"Cinzel", serif',
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#4A2E15",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                  textShadow: "0 1px 0 rgba(232,208,154,0.3)",
                }}>
                  Secret Key
                </label>
                <div className="relative" style={{
                  borderRadius: "5px",
                  background: "linear-gradient(to bottom, #150A04, #1E120A, #24140D)",
                  border: `1.5px solid ${focused === "pass" ? "#E4C76A" : "#9A7B50"}`,
                  boxShadow: focused === "pass"
                    ? "inset 0 3px 10px rgba(0,0,0,0.85), inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(232,208,154,0.08), 0 0 12px rgba(201,162,74,0.12)"
                    : "inset 0 3px 10px rgba(0,0,0,0.85), inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(232,208,154,0.08)",
                  transition: "border-color 250ms, box-shadow 250ms",
                  height: "44px",
                }}>
                  <div style={{
                    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", zIndex: 2,
                    color: focused === "pass" ? "#E4C76A" : "#8C6D46", transition: "color 250ms",
                  }}>
                    <svg style={{ width: "15px", height: "15px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    className="placeholder-[#6B4F30]"
                    style={{
                      width: "100%", height: "100%", background: "transparent", border: "none", outline: "none",
                      paddingLeft: "38px",
                      paddingRight: "38px",
                      fontFamily: '"Georgia", serif',
                      fontSize: "13px",
                      fontWeight: 400, color: "#F4E6C2", letterSpacing: "0.15em",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                      zIndex: 2, background: "none", border: "none", cursor: "pointer", color: "#8C6D46", padding: 0, display: "flex",
                    }}
                  >
                    {showPassword ? (
                      <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* JOIN THE CREW BUTTON */}
              <button
                type="submit"
                disabled={isPending}
                className="relative group"
                style={{
                  marginTop: "14px",
                  width: "100%",
                  height: "50px",
                  minHeight: "50px",
                  padding: "0 24px",
                  borderRadius: "6px",
                  border: "1px solid #7B5C35",
                  cursor: isPending ? "wait" : "pointer",
                  background: `
                    repeating-linear-gradient(173deg, rgba(20,5,5,0.06) 0px, rgba(20,5,5,0.06) 1px, transparent 1px, transparent 3px),
                    repeating-linear-gradient(4deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 2px, transparent 2px, transparent 6px),
                    radial-gradient(ellipse at 50% -20%, #8A1A1A 0%, #5A0A0A 50%, #2F0505 100%)
                  `,
                  boxShadow: `
                    0 8px 14px rgba(0,0,0,0.45),
                    0 2px 4px rgba(0,0,0,0.6),
                    inset 0 1px 1px rgba(255,210,120,0.25),
                    inset 0 -3px 6px rgba(10,0,0,0.6)
                  `,
                  outline: focused === "button" ? "2px solid #C9A24A" : "none",
                  outlineOffset: "2px",
                  transition: "transform 200ms ease, box-shadow 200ms ease, filter 200ms ease",
                  opacity: isPending ? 0.7 : 1,
                }}
                onFocus={() => setFocused("button")}
                onBlur={() => setFocused(null)}
              >
                {/* Inner Bevel & Corner Rivets */}
                <div style={{
                  position: "absolute",
                  inset: "5px",
                  border: "1px solid rgba(20,0,0,0.6)",
                  borderRadius: "3px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 0 rgba(255,210,120,0.12)",
                  pointerEvents: "none",
                }}>
                  <div style={{ position: "absolute", top: "3px", left: "3px", width: "3.5px", height: "3.5px", borderRadius: "50%", background: "#111", border: "1px solid #7B5C35" }} />
                  <div style={{ position: "absolute", top: "3px", right: "3px", width: "3.5px", height: "3.5px", borderRadius: "50%", background: "#111", border: "1px solid #7B5C35" }} />
                  <div style={{ position: "absolute", bottom: "3px", left: "3px", width: "3.5px", height: "3.5px", borderRadius: "50%", background: "#111", border: "1px solid #7B5C35" }} />
                  <div style={{ position: "absolute", bottom: "3px", right: "3px", width: "3.5px", height: "3.5px", borderRadius: "50%", background: "#111", border: "1px solid #7B5C35" }} />
                </div>

                <span style={{
                  position: "relative", zIndex: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px",
                  fontFamily: '"Cinzel", serif',
                  fontSize: "13px",
                  fontWeight: 700, letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#E2C465",
                  textShadow: "0 1px 1px rgba(255,230,160,0.15), 0 -1px 1px rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                }}>
                  {isPending ? (
                    <>
                      <svg className="animate-spin" style={{ width: "16px", height: "16px" }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying Orders...
                    </>
                  ) : (
                    <>
                      <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="2" />
                        <path d="M12 7v12" />
                        <path d="M9 10h6" />
                        <path d="M5 13c0 4.5 3.5 6 7 6s7-1.5 7-6" />
                        <path d="M4 11l1 2 1-2" />
                        <path d="M20 11l-1 2-1-2" />
                      </svg>
                      Join the Crew
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Footer link to register */}
            <div className="mt-3 text-center">
              <p style={{
                fontFamily: '"Cinzel", serif',
                fontSize: "10px",
                fontWeight: 600,
                color: "#5C3A1E",
                letterSpacing: "0.08em",
                margin: 0,
              }}>
                No pirate commission?{" "}
                <Link href="/register" style={{ color: "#8A1A1A", fontWeight: 700, textDecoration: "underline" }}>
                  Enlist in the crew
                </Link>
              </p>
            </div>

          </div>{/* close inner content group */}
        </div>
      </div>
    </div>
  )
}
