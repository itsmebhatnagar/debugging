"use client"

import { use, useEffect, useState, useRef } from "react"
import { useRealtime } from "@/hooks/useRealtime"
import Editor from "@monaco-editor/react"
import ReactMarkdown from "react-markdown"
import { compileCode, submitFinalCode, saveDraft, startRoundNow, recordDisqualification, autoSubmitRound } from "@/app/actions/participant"
import Link from "next/link"
import { Spotlight } from "@/components/ui/spotlight"
import {
  Anchor,
  Compass,
  Scroll,
  Swords,
  Waves,
  ShieldAlert,
  Radio,
  Clock,
  Trophy,
  Crown,
  Medal,
  Flame,
  AlertTriangle,
  Skull,
  Ship,
  Maximize2,
  CheckCircle2,
  RotateCcw
} from "lucide-react"

interface QuestionData {
  id: string
  title: string
  description: string
  points: number
  starterCodes: Array<{ language: string; code: string }>
  testCases: Array<{ input: string; expected: string }>
}

interface RoundData {
  id: string
  name: string
  order: number
  maxCompileAttempts: number
  questions: QuestionData[]
}

function getDefaultStarterCode(lang: string, title?: string): string {
  const norm = (lang || "").toLowerCase()
  if (norm === "c") {
    return `// Echona 2K26 — Pirate Code Championship
// Challenge: ${title || "Pirate Trial"}
// Compiler: GCC 14+ (C17 / C23)

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    char input[4096];
    if (fgets(input, sizeof(input), stdin)) {
        input[strcspn(input, "\\r\\n")] = 0;
        // Write your solution here
        printf("%s\\n", input);
    }
    return 0;
}
`
  }
  if (norm === "cpp") {
    return `// Echona 2K26 — Pirate Code Championship
// Challenge: ${title || "Pirate Trial"}
// Compiler: G++ 14+ (C++20 / C++23)

#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string line;
    if (getline(cin, line)) {
        // Write your solution here
        cout << line << "\\n";
    }
    return 0;
}
`
  }
  if (norm === "java") {
    return `// Echona 2K26 — Pirate Code Championship
// Challenge: ${title || "Pirate Trial"}
// Compiler: OpenJDK 22+ (Java 22)

import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line != null) {
            // Write your solution here
            System.out.println(line);
        }
    }
}
`
  }
  if (norm === "python") {
    return `# Echona 2K26 — Pirate Code Championship
# Challenge: ${title || "Pirate Trial"}
# Python 3.12+
import sys

def solve():
    raw_input = sys.stdin.read().strip()
    # Write your solution here
    print(raw_input)

if __name__ == "__main__":
    solve()
`
  }
  return `// Echona 2K26 — Pirate Code Championship
// Challenge: ${title || "Pirate Trial"}
// JavaScript (Node.js)
const fs = require('fs');

function solve(input) {
  // Write your code here
  return input;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(solve(input));
`
}

function getQuestionStarterCode(q: QuestionData | undefined, lang: string): string {
  if (!q) return getDefaultStarterCode(lang)
  const norm = (lang || "").toLowerCase()
  const found = q.starterCodes?.find(
    (s) => s.language.toLowerCase() === norm
  )
  if (found?.code && found.code.trim().length > 0) {
    return found.code
  }
  return getDefaultStarterCode(lang, q.title)
}

export default function CompetitionArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = use(params)
  const { socket, connected } = useRealtime(competitionId)

  const [arenaState, setArenaState] = useState<"LOADING" | "WAITING" | "COUNTDOWN" | "SPLASH" | "ACTIVE" | "ENDED">("LOADING")
  const [competitionName, setCompetitionName] = useState("Echona 2K26 — Pirate Code Championship")
  const [countdownSeconds, setCountdownSeconds] = useState(60)
  const [splashRoundName, setSplashRoundName] = useState("Quest for the Lost Treasure")
  const [round, setRound] = useState<RoundData | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [language, setLanguage] = useState("c")
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [submissions, setSubmissions] = useState<Record<string, string>>({})
  const [output, setOutput] = useState<string>("")
  const [isCompiling, setIsCompiling] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attemptErrorModal, setAttemptErrorModal] = useState<string | null>(null)
  const [top3Winners, setTop3Winners] = useState<any[]>([])

  // ── FULLSCREEN & ANTI-CHEAT ENFORCEMENT ─────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [needsFullscreen, setNeedsFullscreen] = useState(false)
  const [fullscreenExitWarning, setFullscreenExitWarning] = useState(false)
  const [autoSubmitDone, setAutoSubmitDone] = useState(false)
  const [fullscreenExited, setFullscreenExited] = useState(false) // permanent lock once exited
  const [dqReason, setDqReason] = useState<string | null>("FULLSCREEN_EXIT")
  const [securityToast, setSecurityToast] = useState<string | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAutoSubmittingRound = useRef(false)
  const editorRef = useRef<any>(null)
  const [hasEnteredFullscreenOnce, setHasEnteredFullscreenOnce] = useState(false)
  const currentUserIdRef = useRef<string | null>(null)

  const showSecurityToast = (msg: string) => {
    setSecurityToast(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => {
      setSecurityToast(null)
    }, 2800)
  }

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/competition/${competitionId}/status`)
      const data = await res.json()
      if (data.userId) currentUserIdRef.current = data.userId
      if (data.competitionName) setCompetitionName(data.competitionName)

      // If user was previously disqualified, persist lockout
      if (data.isDisqualified) {
        setFullscreenExited(true)
        setDqReason(data.dqReason || "FULLSCREEN_EXIT")
        setNeedsFullscreen(true)
        setAutoSubmitDone(true)
      } else {
        setFullscreenExited(false)
        setDqReason(null)
      }

      if (data.status === "WAITING" || data.status === "WAITING_ROUND") {
        setArenaState("WAITING")
      } else if (data.status === "COUNTDOWN") {
        setArenaState("COUNTDOWN")
        setCountdownSeconds(data.countdownSeconds || 60)
        setSplashRoundName(data.roundName || "Quest for the Lost Treasure")
      } else if (data.status === "ACTIVE_ROUND") {
        setRound(data.round)
        setArenaState("ACTIVE")
        setNeedsFullscreen(true)
        const currentlyFs = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
        setIsFullscreen(currentlyFs)
        if (currentlyFs) {
          setHasEnteredFullscreenOnce(true)
        }
        if (data.userState) {
          setAttempts(data.userState.attempts || {})
          setSubmissions(data.userState.submissions || {})
          const newCodes: Record<string, string> = {}
          data.round.questions.forEach((q: QuestionData) => {
            q.starterCodes?.forEach((sc) => {
              newCodes[`${q.id}_${sc.language.toLowerCase()}`] = sc.code
            })
            const draft = data.userState.drafts?.[q.id]
            if (draft?.code) {
              newCodes[q.id] = draft.code
              if (draft.language) {
                newCodes[`${q.id}_${draft.language.toLowerCase()}`] = draft.code
              }
            } else {
              const starter = getQuestionStarterCode(q, language)
              newCodes[q.id] = starter
              newCodes[`${q.id}_${language.toLowerCase()}`] = starter
            }
          })
          setCodes(newCodes)
        }
      } else if (data.status === "ENDED") {
        setArenaState("ENDED")
      }
    } catch {
      setArenaState("WAITING")
    }
  }

  useEffect(() => { fetchStatus() }, [competitionId])

  // ── FULLSCREEN REQUEST & KEYBOARD LOCK ──────────────────────────
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement
      if (el.requestFullscreen) await el.requestFullscreen()
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen()
      else if ((el as any).mozRequestFullScreen) await (el as any).mozRequestFullScreen()
      else if ((el as any).msRequestFullscreen) await (el as any).msRequestFullscreen()

      // Request Chromium Keyboard Lock API to lock Escape, Tab, Alt, Meta keys while in fullscreen
      if (typeof window !== "undefined" && "keyboard" in navigator && (navigator as any).keyboard?.lock) {
        try {
          await (navigator as any).keyboard.lock(["Escape", "Tab", "AltLeft", "AltRight", "MetaLeft", "MetaRight"])
        } catch {
          // Handled gracefully if browser restricts keyboard lock
        }
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err)
    }
  }

  // ── AUTO-SUBMIT ENTIRE ROUND & LOCKOUT ─────────────────────────
  const handleRoundAutoSubmit = async (reason: "FULLSCREEN_EXIT" | "TAB_SWITCH" | "WINDOW_BLUR") => {
    if (isAutoSubmittingRound.current || fullscreenExited) return
    isAutoSubmittingRound.current = true

    setFullscreenExited(true)
    setDqReason(reason)
    setFullscreenExitWarning(true)
    setAutoSubmitDone(false)
    setIsSubmitting(true)

    try {
      if (round?.id) {
        // Auto-submit all questions in the round with current codes/drafts
        await autoSubmitRound(competitionId, round.id, codes, language, reason)
      }
      if (round?.questions) {
        const autoSubMap: Record<string, string> = {}
        round.questions.forEach((q) => {
          autoSubMap[q.id] = "AUTO_SUBMITTED"
        })
        setSubmissions((prev) => ({ ...prev, ...autoSubMap }))
      }
      setAutoSubmitDone(true)
    } catch (err) {
      console.error("Auto submit round error:", err)
      setAutoSubmitDone(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Track fullscreen state changes
  useEffect(() => {
    const onFsChange = () => {
      const inFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(inFs)
      if (inFs) {
        setHasEnteredFullscreenOnce(true)
      }
    }
    document.addEventListener("fullscreenchange", onFsChange)
    document.addEventListener("webkitfullscreenchange", onFsChange)
    document.addEventListener("mozfullscreenchange", onFsChange)
    document.addEventListener("MSFullscreenChange", onFsChange)
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange)
      document.removeEventListener("webkitfullscreenchange", onFsChange)
      document.removeEventListener("mozfullscreenchange", onFsChange)
      document.removeEventListener("MSFullscreenChange", onFsChange)
    }
  }, [])

  // When ACTIVE + user previously entered fullscreen + now exits → auto-submit ENTIRE round + PERMANENT LOCK
  useEffect(() => {
    if (arenaState !== "ACTIVE") return
    if (!needsFullscreen) return
    if (hasEnteredFullscreenOnce && !isFullscreen && !fullscreenExited) {
      // Fullscreen was exited after having entered — auto-submit round and permanently lock participant
      handleRoundAutoSubmit("FULLSCREEN_EXIT")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, hasEnteredFullscreenOnce, arenaState, needsFullscreen, fullscreenExited])

  // ── ANTI-CHEAT: PREVENT CUT, COPY, PASTE, DRAG & DROP, CONTEXT MENU ──
  useEffect(() => {
    if (arenaState !== "ACTIVE" || !hasEnteredFullscreenOnce || fullscreenExited) return

    const blockClipboard = (e: ClipboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      showSecurityToast("Action Blocked: Cut, copy, and paste are strictly prohibited!")
    }

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      showSecurityToast("Action Blocked: Right-click context menu is disabled!")
    }

    const blockDrag = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const blockSelect = (e: Event) => {
      const target = e.target as HTMLElement
      // Prevent selecting problem statement or mission briefing text to copy
      if (!target?.closest?.(".monaco-editor")) {
        e.preventDefault()
      }
    }

    document.addEventListener("copy", blockClipboard, true)
    document.addEventListener("cut", blockClipboard, true)
    document.addEventListener("paste", blockClipboard, true)
    document.addEventListener("contextmenu", blockContextMenu, true)
    document.addEventListener("dragstart", blockDrag, true)
    document.addEventListener("dragover", blockDrag, true)
    document.addEventListener("drop", blockDrag, true)
    document.addEventListener("selectstart", blockSelect, true)

    return () => {
      document.removeEventListener("copy", blockClipboard, true)
      document.removeEventListener("cut", blockClipboard, true)
      document.removeEventListener("paste", blockClipboard, true)
      document.removeEventListener("contextmenu", blockContextMenu, true)
      document.removeEventListener("dragstart", blockDrag, true)
      document.removeEventListener("dragover", blockDrag, true)
      document.removeEventListener("drop", blockDrag, true)
      document.removeEventListener("selectstart", blockSelect, true)
    }
  }, [arenaState, hasEnteredFullscreenOnce, fullscreenExited])

  // ── ANTI-CHEAT: PREVENT TAB SWITCHING, WINDOWS+TAB, CTRL+TAB, BLUR ──
  useEffect(() => {
    if (arenaState !== "ACTIVE" || !hasEnteredFullscreenOnce || fullscreenExited) return

    // 1. Capturing KeyDown listener to block Windows key, Ctrl+Tab, Alt+Tab, etc.
    const onKeyDown = (e: KeyboardEvent) => {
      // A. Windows Key (Meta)
      if (
        e.key === "Meta" ||
        e.code === "MetaLeft" ||
        e.code === "MetaRight" ||
        e.keyCode === 91 ||
        e.keyCode === 92
      ) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Windows key is disabled during the tournament!")
        return false
      }

      // B. Tab combinations: Ctrl + Tab, Ctrl + Shift + Tab, Alt + Tab, Meta + Tab
      if (e.key === "Tab" || e.code === "Tab" || e.keyCode === 9) {
        if (e.ctrlKey || e.altKey || e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          showSecurityToast("Tab switching shortcuts are strictly forbidden!")
          return false
        }
      }

      // C. Browser tab paging: Ctrl + PageUp / PageDown
      if ((e.ctrlKey || e.metaKey) && (e.key === "PageUp" || e.key === "PageDown")) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Tab navigation is strictly forbidden!")
        return false
      }

      // D. Window / Tab creation & closure: Ctrl + T, Ctrl + N, Ctrl + W, Ctrl + Shift + T/N/W
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === "t" || k === "n" || k === "w") {
          e.preventDefault()
          e.stopPropagation()
          showSecurityToast("Opening or closing tabs is prohibited!")
          return false
        }
      }

      // E. Window management: Alt + F4, Alt + ArrowLeft/Right
      if (e.altKey && (e.key === "F4" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // F. Fullscreen exit attempt via Escape or F11
      if (e.key === "Escape" || e.key === "F11") {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Exiting fullscreen will auto-submit your round and disqualify you!")
        return false
      }

      // G. Developer tools & page reload
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j" || e.key.toLowerCase() === "c")) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") ||
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")
      ) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Developer tools and reloading are strictly prohibited!")
        return false
      }

      // H. Cut, Copy, Paste shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Insert/Delete)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "v" || e.key.toLowerCase() === "x" || e.key === "Insert")
      ) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Action Blocked: Cut, copy, and paste are strictly prohibited!")
        return false
      }
      if (e.shiftKey && (e.key === "Insert" || e.key === "Delete")) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Action Blocked: Cut, copy, and paste are strictly prohibited!")
        return false
      }
    }

    // 2. Visibility Change: triggers when tab switches or browser minimizes
    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState === "hidden") {
        handleRoundAutoSubmit("TAB_SWITCH")
      }
    }

    window.addEventListener("keydown", onKeyDown, true)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaState, hasEnteredFullscreenOnce, fullscreenExited, round, codes, language])

  // Monaco Editor mount hook to disable contextmenu and internal clipboard
  const handleEditorMount = (editor: any) => {
    editorRef.current = editor

    editor.onKeyDown((e: any) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      if (
        isCtrlOrCmd &&
        (e.code === "KeyC" || e.code === "KeyV" || e.code === "KeyX" || e.code === "Insert")
      ) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Clipboard shortcuts are disabled in the editor!")
        return
      }
      if (e.shiftKey && (e.code === "Insert" || e.code === "Delete")) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Clipboard shortcuts are disabled in the editor!")
        return
      }
      if (e.code === "Tab" && (e.ctrlKey || e.metaKey || e.altKey)) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Tab switching is strictly forbidden!")
        return
      }
      if (e.code === "MetaLeft" || e.code === "MetaRight") {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast("Windows key is disabled!")
        return
      }
    })

    const dom = editor.getDomNode()
    if (dom) {
      dom.addEventListener(
        "paste",
        (e: any) => {
          e.preventDefault()
          e.stopPropagation()
          showSecurityToast("Pasting code is strictly prohibited!")
        },
        true
      )
      dom.addEventListener(
        "copy",
        (e: any) => {
          e.preventDefault()
          e.stopPropagation()
          showSecurityToast("Copying code is strictly prohibited!")
        },
        true
      )
      dom.addEventListener(
        "cut",
        (e: any) => {
          e.preventDefault()
          e.stopPropagation()
          showSecurityToast("Cutting code is strictly prohibited!")
        },
        true
      )
      dom.addEventListener(
        "beforeinput",
        (e: any) => {
          if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") {
            e.preventDefault()
            e.stopPropagation()
            showSecurityToast("Pasting is strictly prohibited!")
          }
        },
        true
      )
      dom.addEventListener(
        "contextmenu",
        (e: any) => {
          e.preventDefault()
          e.stopPropagation()
        },
        true
      )
      dom.addEventListener(
        "drop",
        (e: any) => {
          e.preventDefault()
          e.stopPropagation()
        },
        true
      )
    }
  }

  useEffect(() => {
    if (!socket) return
    socket.on("test_starting", (data: any) => {
      setArenaState("COUNTDOWN")
      setCountdownSeconds(data.countdownSeconds || 60)
      setSplashRoundName(data.roundName || "Quest for the Lost Treasure")
      // Reset fullscreen states on test restart so participant is prompted freshly
      setFullscreenExited(false)
      setHasEnteredFullscreenOnce(false)
      setFullscreenExitWarning(false)
      setAutoSubmitDone(false)
      isAutoSubmittingRound.current = false
    })
    socket.on("round_started", (data: any) => {
      setSplashRoundName(data.roundName)
      // Reset lockout states on round transition
      setFullscreenExited(false)
      setHasEnteredFullscreenOnce(false)
      setNeedsFullscreen(true)   // ← trigger fullscreen requirement
      isAutoSubmittingRound.current = false
      const currentlyFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(currentlyFs)
      if (currentlyFs) {
        setHasEnteredFullscreenOnce(true)
      }
      setFullscreenExitWarning(false)
      setAutoSubmitDone(false)
      setArenaState("SPLASH")    // show splash (ok even if already SPLASH)
      setTimeout(() => {
        setRound({ id: data.roundId, name: data.roundName, order: data.roundOrder, maxCompileAttempts: data.maxCompileAttempts, questions: data.questions })
        const initialCodes: Record<string, string> = {}
        data.questions.forEach((q: QuestionData) => {
          q.starterCodes?.forEach((sc: any) => {
            initialCodes[`${q.id}_${sc.language.toLowerCase()}`] = sc.code
          })
          const starter = getQuestionStarterCode(q, language)
          initialCodes[q.id] = starter
          initialCodes[`${q.id}_${language.toLowerCase()}`] = starter
        })
        setCodes(initialCodes)
        setSelectedQuestionIndex(0)
        setArenaState("ACTIVE")
      }, 3000)
    })
    socket.on("attempt_exceeded", (data: any) => {
      setAttempts((prev) => ({ ...prev, [data.questionId]: data.maxAttempts }))
      setSubmissions((prev) => ({ ...prev, [data.questionId]: "AUTO_SUBMITTED" }))
    })
    socket.on("test_ended", (data: any) => {
      setArenaState("ENDED")
      if (data.top3Winners) setTop3Winners(data.top3Winners)
    })
    socket.on("participant_disqualified", (data: any) => {
      if (!currentUserIdRef.current || data.userId === currentUserIdRef.current) {
        setFullscreenExited(true)
        setDqReason(data.reason || "ADMIN_DISQUALIFIED")
        setNeedsFullscreen(true)
        setAutoSubmitDone(true)
      }
    })
    socket.on("participant_status_changed", (data: any) => {
      if (currentUserIdRef.current && data.userId === currentUserIdRef.current) {
        if (data.status === "DISQUALIFIED") {
          setFullscreenExited(true)
          setDqReason(data.reason || "ADMIN_DISQUALIFIED")
          setNeedsFullscreen(true)
          setAutoSubmitDone(true)
        } else if (data.status === "QUALIFIED") {
          setFullscreenExited(false)
          setDqReason(null)
          fetchStatus()
        } else if (data.status === "WAITING") {
          setFullscreenExited(false)
          setDqReason(null)
          setArenaState("WAITING")
        }
      }
    })
    return () => {
      socket.off("test_starting")
      socket.off("round_started")
      socket.off("attempt_exceeded")
      socket.off("test_ended")
      socket.off("participant_disqualified")
      socket.off("participant_status_changed")
    }
  }, [socket])

  useEffect(() => {
    if (arenaState !== "COUNTDOWN") return
    if (countdownSeconds <= 0) {
      // Wrap async call to avoid unhandled promise in useEffect
      void handleStartTestNow()
      return
    }
    const interval = setInterval(() => setCountdownSeconds((prev) => prev - 1), 1000)
    return () => clearInterval(interval)
  }, [arenaState, countdownSeconds])

  const handleStartTestNow = async () => {
    // Prevent double-trigger
    if (arenaState !== "COUNTDOWN") return
    setArenaState("SPLASH")
    try {
      // Activate the round in the database — this triggers the socket 'round_started' event
      // which will transition us from SPLASH → ACTIVE with full round data
      await startRoundNow(competitionId)
    } catch {
      // If socket fires first that's fine; if activation fails, fall back to polling
      setTimeout(() => fetchStatus(), 2000)
    }
  }

  const currentQuestion = round?.questions[selectedQuestionIndex]
  const currentCodeKey = currentQuestion ? `${currentQuestion.id}_${language.toLowerCase()}` : ""
  const currentCode = currentQuestion
    ? (codes[currentCodeKey] ?? codes[currentQuestion.id] ?? getQuestionStarterCode(currentQuestion, language))
    : ""
  const currentAttempts = currentQuestion ? (attempts[currentQuestion.id] || 0) : 0
  const maxAttempts = round?.maxCompileAttempts || 5
  const isQuestionSubmitted = currentQuestion && submissions[currentQuestion.id]
  const attemptsLeft = maxAttempts - currentAttempts

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang)
    if (!currentQuestion) return

    const langKey = `${currentQuestion.id}_${newLang.toLowerCase()}`
    const starter = getQuestionStarterCode(currentQuestion, newLang)
    
    // Live update editor to show the selected language's startup code feeded in the question
    const existingCode = codes[langKey]
    const codeToDisplay = (existingCode !== undefined && existingCode.trim().length > 0) ? existingCode : starter

    setCodes((prev) => ({
      ...prev,
      [langKey]: codeToDisplay,
      [currentQuestion.id]: codeToDisplay
    }))

    saveDraft(currentQuestion.id, newLang, codeToDisplay).catch(() => {})
    setOutput("")
  }

  const handleResetToStarterCode = () => {
    if (!currentQuestion) return
    const starter = getQuestionStarterCode(currentQuestion, language)
    const langKey = `${currentQuestion.id}_${language.toLowerCase()}`
    setCodes((prev) => ({
      ...prev,
      [langKey]: starter,
      [currentQuestion.id]: starter
    }))
    saveDraft(currentQuestion.id, language, starter).catch(() => {})
    setOutput(`[STARTER CODE RESTORED] Editor code reset to official ${language.toUpperCase()} starter template.\n`)
  }

  const handleCodeChange = (newVal: string | undefined) => {
    if (!currentQuestion) return
    const updated = newVal || ""
    const langKey = `${currentQuestion.id}_${language.toLowerCase()}`
    setCodes((prev) => ({
      ...prev,
      [langKey]: updated,
      [currentQuestion.id]: updated
    }))
    saveDraft(currentQuestion.id, language, updated).catch(() => {})
  }

  const handleCompile = async () => {
    if (!currentQuestion) return
    if (currentAttempts >= maxAttempts) {
      setAttemptErrorModal(`ATTEMPT LIMIT EXHAUSTED! You have consumed all ${maxAttempts}/${maxAttempts} compile attempts. Your code has been automatically locked and submitted!`)
      return
    }
    setIsCompiling(true)
    setOutput("[COMPILING] Hoisting sails — compiling in the Captain's workshop...\n")
    try {
      const res = await compileCode(currentQuestion.id, language, currentCode)
      setIsCompiling(false)
      if (res.success && res.attempt) {
        setAttempts((prev) => ({ ...prev, [currentQuestion.id]: res.attempt.attemptNumber }))
        setOutput(`[COMPILE ATTEMPT ${res.attempt.attemptNumber}/${res.attempt.maxAttempts}]\n\n${res.attempt.result}`)
      } else {
        setOutput(`[ERROR]\n${res.error}`)
        if (res.autoSubmitted) {
          setAttempts((prev) => ({ ...prev, [currentQuestion.id]: maxAttempts }))
          setSubmissions((prev) => ({ ...prev, [currentQuestion.id]: "AUTO_SUBMITTED" }))
          setAttemptErrorModal(res.error)
        }
      }
    } catch (err: any) {
      setIsCompiling(false)
      setOutput(`[NETWORK ERROR] Failed to run code. Please try again.\nDetails: ${err.message}`)
    }
  }

  const handleSubmit = async () => {
    if (!currentQuestion) return
    setIsSubmitting(true)
    setOutput("[DISPATCHING] Sealing your parchment — transmitting to the High Admiral's AI...\n")
    try {
      const res = await submitFinalCode(currentQuestion.id, language, currentCode)
      setIsSubmitting(false)
      if (res.success && res.submission) {
        setSubmissions((prev) => ({ ...prev, [currentQuestion.id]: res.submission.status }))
        setOutput(`[SUCCESS] SUBMISSION RECORDED!\nStatus: ${res.submission.status}\nYour scroll has been received by the Admiral.\n\n(AI is analyzing your code in the background for effort and logic points)`)
        
        // Fire background AI analysis asynchronously (fire and forget)
        fetch('/api/submissions/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: res.submission.id }),
          keepalive: true // ensures the request completes even if the user navigates away
        }).catch(() => {})
        
      } else {
        setOutput(`[SUBMISSION FAILED] ${res.error}`)
      }
    } catch (err: any) {
      setIsSubmitting(false)
      setOutput(`[NETWORK ERROR] Failed to reach the server. Please try again.\nDetails: ${err.message}`)
    }
  }

  // ── STATE: LOADING ────────────────────────────────────────────
  if (arenaState === "LOADING") {
    return (
      <div className="relative min-h-[calc(100vh-80px)] pt-28 pb-16 px-4 flex flex-col items-center justify-center z-10">
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div
            className="h-20 w-20 rounded-full animate-spin"
            style={{
              border: "3px solid transparent",
              borderTopColor: "#d4af37",
              borderRightColor: "rgba(212,175,55,0.4)",
              boxShadow: "0 0 30px rgba(212,175,55,0.3)",
            }}
          />
          <p className="font-cinzel text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-[#d4af37]">
            CHARTING THE SEAS...
          </p>
        </div>
      </div>
    )
  }

  // ── STATE: WAITING ────────────────────────────────────────────
  if (arenaState === "WAITING") {
    return (
      <div className="relative min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden pt-16 lg:pt-0 pb-6 lg:pb-0 px-4 sm:px-6 flex flex-col items-center justify-center z-10">
        
        {/* Subtle ambient nautical background glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-60"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(14,24,44,0.3) 50%, transparent 75%)",
          }}
        />

        {/* Tactical Coordinates Header */}
        <div className="relative z-10 mb-2.5 lg:mb-3 flex items-center gap-2 text-[10px] font-cinzel font-bold tracking-[0.3em] text-[#d4af37]/70 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
          <span>PORT ROYAL ANCHORAGE · 17°26&apos;N 76°48&apos;W</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
        </div>

        <div className="relative z-10 w-full max-w-2xl lg:max-w-5xl animate-treasure-in flex flex-col">
          {/* Dual-border luxury maritime glass container */}
          <div className="relative w-full overflow-hidden rounded-[2rem] lg:rounded-[2.5rem] bg-gradient-to-b from-[#d4af37]/35 via-[#d4af37]/15 to-[#d4af37]/30 p-[1px] shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_50px_rgba(212,175,55,0.08)]">
            <Spotlight className="from-[#f4ede0] via-[#d4af37] to-transparent blur-3xl opacity-35" size={600} />

            <div className="relative w-full rounded-[2rem] lg:rounded-[2.5rem] bg-[#121620]/94 backdrop-blur-2xl p-5 sm:p-7 lg:p-7 border border-[#d4af37]/15 overflow-hidden">
              
              {/* Antique Brass Corner Rivets/Brackets */}
              <span className="pointer-events-none absolute top-4 left-4 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute top-4 right-4 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute bottom-4 left-4 w-3.5 h-3.5 border-b-2 border-l-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute bottom-4 right-4 w-3.5 h-3.5 border-b-2 border-r-2 border-[#d4af37]/50" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
                
                {/* ── LEFT COLUMN: Emblem, Status & Lore ────────────── */}
                <div className="lg:col-span-5 flex flex-col items-center text-center lg:pr-1">
                  
                  {/* Bespoke Nautical Astrolabe & Anchor Crest */}
                  <div className="relative mb-3 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#d4af37]" />
                    <div className="absolute -inset-2.5 rounded-full border border-dashed border-[#d4af37]/30 animate-[spin_40s_linear_infinite]" />
                    <div className="absolute -inset-1 rounded-full border border-[#d4af37]/20" />

                    <div
                      className="relative flex h-14 w-14 lg:h-18 lg:w-18 items-center justify-center rounded-2xl shadow-[0_0_35px_rgba(212,175,55,0.25)] border-2 border-[#d4af37]/60"
                      style={{
                        background: "radial-gradient(circle at 30% 30%, #1e293b 0%, #0a0f1d 75%)",
                      }}
                    >
                      <Anchor className="w-7 h-7 lg:w-9 lg:h-9 text-[#f4ede0] drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)]" strokeWidth={1.75} />
                    </div>
                  </div>

                  {/* Harbor Telemetry Status Pill */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 shadow-[0_0_15px_rgba(212,175,55,0.08)] mb-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    </span>
                    <span className="font-cinzel text-[10px] font-bold tracking-[0.25em] text-[#f4ede0] uppercase">
                      HARBOR FLEET STANDBY
                    </span>
                  </div>

                  {/* Majestic Headline in Cinzel */}
                  <h1 className="font-cinzel text-xl sm:text-2xl lg:text-2xl font-black tracking-[0.08em] text-[#f4ede0] uppercase drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                    WAITING FOR THE CAPTAIN
                  </h1>

                  {/* Subtle Ornamental Gold Divider */}
                  <div className="flex items-center justify-center gap-3 my-2 w-full max-w-xs opacity-75">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#d4af37] to-[#d4af37]/40" />
                    <div className="w-1.5 h-1.5 rotate-45 border border-[#d4af37] bg-[#d4af37]/40" />
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#d4af37] to-[#d4af37]/40" />
                  </div>

                  {/* Dispatch Briefing */}
                  <p className="font-garamond text-xs lg:text-[11px] text-[#c8b887] leading-relaxed max-w-sm mx-auto">
                    The High Admiral is reviewing maritime charts and calibrating the arena. All crews will receive a 60-second preparation countdown to man their cannons!
                  </p>

                  {/* Live Flagship Socket Telemetry */}
                  <div className="mt-3.5 pt-2.5 w-full border-t border-[#d4af37]/15 flex items-center justify-between text-[10px] font-cinzel text-[#8e8271]">
                    <div className="flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-[#d4af37]" />
                      <span className={connected ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                        {connected ? "SECURE UPLINK ESTABLISHED" : "CONNECTING TO FLEET..."}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#695e50] tracking-wider uppercase hidden sm:inline-block">
                      FREQ 4.8 GHZ
                    </span>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Expedition Standing Orders ───────── */}
                <div className="lg:col-span-7 flex flex-col">
                  <div className="w-full rounded-2xl border border-[#d4af37]/25 bg-[#0a0f1d]/75 backdrop-blur-md p-3.5 sm:p-4 lg:p-3.5 text-left shadow-[inset_0_1px_0_rgba(212,175,55,0.1)]">
                    
                    {/* Dossier Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#d4af37]/15">
                      <div className="flex items-center gap-2">
                        <Scroll className="w-3.5 h-3.5 text-[#d4af37]" />
                        <span className="font-cinzel text-[11px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">
                          EXPEDITION STANDING ORDERS
                        </span>
                      </div>
                      <span className="text-[9px] font-cinzel font-semibold tracking-widest text-[#8e8271] uppercase">
                        ARCHIPELAGO · 3 ROUNDS
                      </span>
                    </div>

                    {/* Round Cards */}
                    <div className="space-y-1.5">
                      {[
                        {
                          order: "ROUND I",
                          title: "Quest for the Lost Treasure",
                          lore: "Algorithmic discovery & foundational problem solving",
                          questions: "3 Questions",
                          attempts: "5 Compiles Max",
                          icon: Compass,
                          colorClass: "text-[#d4af37] border-[#d4af37]/30 bg-[#d4af37]/10",
                        },
                        {
                          order: "ROUND II",
                          title: "The Kraken's Trial",
                          lore: "Data structures & treacherous ocean whirlpools",
                          questions: "2 Questions",
                          attempts: "3 Compiles Max",
                          icon: Waves,
                          colorClass: "text-cyan-400 border-cyan-500/30 bg-cyan-950/30",
                        },
                        {
                          order: "ROUND III",
                          title: "Clash of the Captains",
                          lore: "Final computational duel for the legendary bounty",
                          questions: "1 Question",
                          attempts: "2 Compiles Max",
                          icon: Swords,
                          colorClass: "text-amber-400 border-amber-500/30 bg-amber-950/30",
                        },
                      ].map((r) => {
                        const IconComponent = r.icon
                        return (
                          <div
                            key={r.order}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-[#131a29]/60 border border-[#d4af37]/15 hover:border-[#d4af37]/35 transition-all"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${r.colorClass}`}>
                                <IconComponent className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-cinzel text-[10px] font-bold text-[#d4af37] tracking-wider">
                                    {r.order}:
                                  </span>
                                  <span className="font-cinzel text-[11px] font-bold text-[#f4ede0] tracking-wide">
                                    {r.title}
                                  </span>
                                </div>
                                <div className="font-garamond text-[11px] text-[#8e8271]">
                                  {r.lore}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              <span className="px-2 py-0.5 rounded-md border border-[#d4af37]/25 bg-black/40 text-[9px] font-cinzel font-bold text-[#d4af37] tracking-wider">
                                {r.questions}
                              </span>
                              <span className="px-2 py-0.5 rounded-md border border-white/10 bg-black/30 text-[9px] font-cinzel text-[#8e8271] tracking-wider">
                                {r.attempts}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Critical Directive */}
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="text-[10px] font-cinzel tracking-wider leading-relaxed">
                        <span className="font-bold text-amber-300 uppercase">CHRONOMETER PROTOCOL:</span>{" "}
                        <span className="font-garamond text-xs text-amber-200/90 font-medium normal-case">
                          Battle timers run strictly on the High Admiral&apos;s flagship server — hidden from your console to enforce true maritime focus.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── STATE: COUNTDOWN ──────────────────────────────────────────
  if (arenaState === "COUNTDOWN") {
    const isUrgent = countdownSeconds <= 10
    return (
      <div className="relative min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden pt-16 lg:pt-0 pb-6 lg:pb-0 px-4 sm:px-6 flex flex-col items-center justify-center z-10 text-center">
        {/* Subtle ambient nautical background glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-60"
          style={{
            background: isUrgent
              ? "radial-gradient(circle, rgba(239,68,68,0.15) 0%, rgba(14,24,44,0.3) 50%, transparent 75%)"
              : "radial-gradient(circle, rgba(212,175,55,0.1) 0%, rgba(14,24,44,0.3) 50%, transparent 75%)",
            animation: "orbPulse 3s ease-in-out infinite",
          }}
        />

        {/* Tactical Coordinates Header */}
        <div className="relative z-10 mb-2.5 lg:mb-3 flex items-center gap-2 text-[10px] font-cinzel font-bold tracking-[0.3em] text-[#d4af37]/70 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
          <span>PORT ROYAL BATTLE STATIONS · 17°26&apos;N 76°48&apos;W</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
        </div>

        <div className="relative z-10 w-full max-w-xl lg:max-w-4xl animate-treasure-in flex flex-col">
          {/* Dual-border luxury maritime glass container */}
          <div
            className={`relative w-full overflow-hidden rounded-[2rem] lg:rounded-[2.5rem] p-[1px] shadow-[0_25px_80px_rgba(0,0,0,0.85)] transition-all ${
              isUrgent
                ? "bg-gradient-to-b from-red-500/50 via-red-500/20 to-red-500/40 shadow-[0_0_60px_rgba(239,68,68,0.25)]"
                : "bg-gradient-to-b from-[#d4af37]/35 via-[#d4af37]/15 to-[#d4af37]/30"
            }`}
          >
            <Spotlight className={isUrgent ? "from-red-500/30 via-[#d4af37]/20 to-transparent blur-3xl opacity-35" : "from-[#f4ede0] via-[#d4af37] to-transparent blur-3xl opacity-35"} size={600} />

            <div className="relative w-full rounded-[2rem] lg:rounded-[2.5rem] bg-[#121620]/94 backdrop-blur-2xl p-6 sm:p-8 lg:p-8 border border-[#d4af37]/15 overflow-hidden">
              
              {/* Antique Brass Corner Rivets/Brackets */}
              <span className={`pointer-events-none absolute top-4 left-4 w-3.5 h-3.5 border-t-2 border-l-2 ${isUrgent ? "border-red-500/60" : "border-[#d4af37]/50"}`} />
              <span className={`pointer-events-none absolute top-4 right-4 w-3.5 h-3.5 border-t-2 border-r-2 ${isUrgent ? "border-red-500/60" : "border-[#d4af37]/50"}`} />
              <span className={`pointer-events-none absolute bottom-4 left-4 w-3.5 h-3.5 border-b-2 border-l-2 ${isUrgent ? "border-red-500/60" : "border-[#d4af37]/50"}`} />
              <span className={`pointer-events-none absolute bottom-4 right-4 w-3.5 h-3.5 border-b-2 border-r-2 ${isUrgent ? "border-red-500/60" : "border-[#d4af37]/50"}`} />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                
                {/* ── LEFT COLUMN: Battle Briefing & Instant CTA ── */}
                <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
                  
                  {/* Top row badge */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <div
                      className={`relative flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_0_25px_rgba(212,175,55,0.25)] border-2 ${
                        isUrgent ? "border-red-500/70" : "border-[#d4af37]/60"
                      }`}
                      style={{
                        background: isUrgent
                          ? "radial-gradient(circle at 30% 30%, #260808 0%, #0d0202 75%)"
                          : "radial-gradient(circle at 30% 30%, #1e293b 0%, #0a0f1d 75%)",
                      }}
                    >
                      <Swords className={`w-5 h-5 ${isUrgent ? "text-red-400" : "text-[#ffd700]"}`} strokeWidth={1.75} />
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/40 bg-red-950/40 text-red-400 font-cinzel text-[10px] font-bold tracking-[0.2em] uppercase">
                      <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                      BATTLE COMMENCING · CANNONS PRIMED
                    </div>
                  </div>

                  {/* Headline */}
                  <h1 className="font-cinzel text-2xl sm:text-3xl lg:text-3xl font-black text-[#fdf6e2] uppercase tracking-[0.08em] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                    PREPARE YE CANNONS!
                  </h1>

                  {/* Voyage indicator */}
                  <div className="mt-1 flex items-center gap-2 font-garamond text-sm text-[#c8b887]">
                    <span>Next Voyage:</span>
                    <span className="font-cinzel font-bold text-[#ffd700] tracking-wider uppercase text-xs px-2.5 py-0.5 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10">
                      {splashRoundName}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-2.5 w-full max-w-md opacity-75">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#d4af37] to-[#d4af37]/40" />
                    <div className="w-1.5 h-1.5 rotate-45 border border-[#d4af37] bg-[#d4af37]/40" />
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#d4af37] to-[#d4af37]/40" />
                  </div>

                  <p className="font-garamond text-xs sm:text-sm text-[#a09483] leading-relaxed max-w-md mb-4">
                    The High Admiral has sounded battle stations. The sails hoist automatically when the chronometer strikes zero, or embark immediately below!
                  </p>

                  <button
                    onClick={handleStartTestNow}
                    className="flex items-center justify-center gap-3 border border-[#d4af37]/60 bg-gradient-to-r from-[#d4af37]/20 via-[#ffd700]/25 to-[#d4af37]/20 hover:from-[#d4af37]/35 hover:to-[#ffd700]/40 font-cinzel text-[#f4ede0] w-full sm:w-auto px-8 py-3 rounded-xl text-xs sm:text-sm font-bold tracking-[0.25em] uppercase transition-all shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Swords className="w-4 h-4 text-[#ffd700]" />
                    ENTER BATTLE ARENA NOW
                    <Swords className="w-4 h-4 text-[#ffd700]" />
                  </button>
                </div>

                {/* ── RIGHT COLUMN: Massive Glowing Chronometer ───── */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center">
                  <div
                    className="relative flex h-36 w-36 sm:h-40 sm:w-40 lg:h-44 lg:w-44 items-center justify-center rounded-full p-3 transition-all"
                    style={{
                      background: "radial-gradient(circle at 35% 35%, #1e293b 0%, #0a0f1d 75%)",
                      border: `3px solid ${isUrgent ? "#ef4444" : "#ffd700"}`,
                      boxShadow: `0 0 ${isUrgent ? "50px rgba(239,68,68,0.5)" : "40px rgba(255,215,0,0.3)"}`,
                    }}
                  >
                    {/* Rotating degree ring */}
                    <div className="absolute -inset-3 rounded-full border border-dashed border-[#d4af37]/30 animate-[spin_50s_linear_infinite]" />
                    <div className="absolute -inset-1 rounded-full border border-[#d4af37]/20" />

                    <div className="flex flex-col items-center justify-center">
                      <span
                        className="font-cinzel text-4xl sm:text-5xl lg:text-5xl font-black leading-none"
                        style={{
                          color: isUrgent ? "#ef4444" : "#ffd700",
                          textShadow: `0 0 25px ${isUrgent ? "rgba(239,68,68,0.8)" : "rgba(255,215,0,0.6)"}`,
                          animation: isUrgent ? "urgentPulse 0.8s ease-in-out infinite" : undefined,
                        }}
                      >
                        {countdownSeconds}
                      </span>
                      <span className="font-cinzel text-[10px] sm:text-xs font-bold text-[#8e8271] tracking-[0.25em] uppercase mt-2">
                        SECONDS
                      </span>
                    </div>
                  </div>

                  <span className="mt-3 font-cinzel text-[9px] tracking-[0.25em] text-[#8e8271] uppercase">
                    CHRONOMETER SYNC · CANNONS READY
                  </span>
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── STATE: ROUND SPLASH ───────────────────────────────────────
  if (arenaState === "SPLASH") {
    return (
      <div className="relative min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden pt-20 lg:pt-14 pb-12 lg:pb-3 px-4 flex flex-col items-center justify-center z-10 text-center">
        {/* Subtle ambient nautical background glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-60"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(14,24,44,0.3) 50%, transparent 75%)",
          }}
        />

        {/* Tactical Coordinates Header */}
        <div className="relative z-10 mb-2.5 lg:mb-2 flex items-center gap-2 text-[10px] font-cinzel font-bold tracking-[0.3em] text-[#d4af37]/70 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
          <span>PORT ROYAL ADMIRALTY · ENTERING ARENA VOYAGE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
        </div>

        <div className="relative z-10 w-full max-w-2xl animate-treasure-in max-h-[96vh] lg:max-h-[92vh] flex flex-col min-h-0">
          {/* Dual-border luxury maritime glass container */}
          <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#d4af37]/35 via-[#d4af37]/15 to-[#d4af37]/30 p-[1px] shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_50px_rgba(212,175,55,0.08)] flex flex-col min-h-0">
            <Spotlight className="from-[#f4ede0] via-[#d4af37] to-transparent blur-3xl opacity-35" size={500} />

            <div className="relative w-full rounded-[2.5rem] bg-[#121620]/92 backdrop-blur-2xl p-5 sm:p-7 lg:p-5 border border-[#d4af37]/15 flex flex-col items-center text-center overflow-y-auto scrollbar-none">
              
              {/* Antique Brass Corner Rivets/Brackets */}
              <span className="pointer-events-none absolute top-4 left-4 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute top-4 right-4 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute bottom-4 left-4 w-3.5 h-3.5 border-b-2 border-l-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute bottom-4 right-4 w-3.5 h-3.5 border-b-2 border-r-2 border-[#d4af37]/50" />

              {/* Bespoke Nautical Crest */}
              <div className="relative mb-3 lg:mb-2.5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#d4af37]" />
                <div className="absolute -inset-2.5 rounded-full border border-dashed border-[#d4af37]/30 animate-[spin_40s_linear_infinite]" />
                <div className="absolute -inset-1 rounded-full border border-[#d4af37]/20" />

                <div
                  className="relative flex h-16 w-16 lg:h-18 lg:w-18 items-center justify-center rounded-2xl shadow-[0_0_35px_rgba(212,175,55,0.25)] border-2 border-[#d4af37]/60"
                  style={{
                    background: "radial-gradient(circle at 30% 30%, #1e293b 0%, #0a0f1d 75%)",
                  }}
                >
                  <Ship className="w-8 h-8 lg:w-9 lg:h-9 text-[#ffd700] drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)]" strokeWidth={1.75} />
                </div>
              </div>

              {/* Status Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 shadow-[0_0_15px_rgba(212,175,55,0.08)] mb-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </span>
                <span className="font-cinzel text-[10px] sm:text-[11px] font-bold tracking-[0.25em] text-[#f4ede0] uppercase">
                  ENTERING ARENA · HOISTING CODE SCROLLS
                </span>
              </div>

              {/* Majestic Headline */}
              <h1 className="font-cinzel text-2xl sm:text-4xl lg:text-3xl font-black tracking-[0.08em] text-[#f4ede0] uppercase mt-1 drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                {splashRoundName}
              </h1>

              {/* Subtle Ornamental Gold Divider */}
              <div className="flex items-center justify-center gap-3 my-2 w-full max-w-xs opacity-75">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#d4af37] to-[#d4af37]/40" />
                <div className="w-1.5 h-1.5 rotate-45 border border-[#d4af37] bg-[#d4af37]/40" />
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#d4af37] to-[#d4af37]/40" />
              </div>

              {/* Dispatch Briefing */}
              <p className="font-garamond text-xs sm:text-base lg:text-xs text-[#c8b887] leading-relaxed max-w-lg mx-auto tracking-wide">
                Hoisting code scrolls and charting battle coordinates... May fortune favor your algorithms in the trials ahead!
              </p>

              {/* Animated Gold Loading Bar */}
              <div className="mt-4 w-full max-w-md h-2 bg-[#0a1224] rounded-full overflow-hidden border border-[#d4af37]/30 p-[1px] shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <div
                  className="h-full bg-gradient-to-r from-[#d4af37] via-[#ffe066] to-[#ffd700] rounded-full"
                  style={{ animation: "scanLine 2.5s linear forwards", width: "100%" }}
                />
              </div>

              <span className="font-cinzel text-[9px] tracking-[0.25em] text-[#8e8271] uppercase mt-2">
                INITIALIZING MONACO COMPILER & FLEET TELEMETRY...
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── STATE: ENDED ──────────────────────────────────────────────
  if (arenaState === "ENDED") {
    return (
      <div className="relative min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden pt-20 lg:pt-14 pb-12 lg:pb-3 px-4 flex flex-col items-center justify-center z-10 text-center">
        <div className="relative z-10 w-full max-w-3xl animate-treasure-in lg:max-h-[92vh] flex flex-col">
          <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#d4af37]/35 via-[#d4af37]/15 to-[#d4af37]/30 p-[1px] shadow-[0_25px_80px_rgba(0,0,0,0.85)]">
            <Spotlight className="from-[#f4ede0] via-[#d4af37] to-transparent blur-3xl opacity-35" size={500} />

            <div className="relative w-full rounded-[2.5rem] bg-[#121620]/92 backdrop-blur-2xl p-6 sm:p-9 lg:p-6 border border-[#d4af37]/15 flex flex-col items-center text-center overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-none">
              {/* Corner brackets */}
              <span className="pointer-events-none absolute top-4 left-4 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute top-4 right-4 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute bottom-4 left-4 w-3.5 h-3.5 border-b-2 border-l-2 border-[#d4af37]/50" />
              <span className="pointer-events-none absolute bottom-4 right-4 w-3.5 h-3.5 border-b-2 border-r-2 border-[#d4af37]/50" />

              <div className="flex h-16 w-16 lg:h-18 lg:w-18 items-center justify-center rounded-2xl mx-auto mb-3 border-2 border-[#d4af37]/60 shadow-[0_0_35px_rgba(212,175,55,0.3)] bg-gradient-to-br from-[#1e293b] to-[#0a0f1d] animate-float">
                <Trophy className="w-8 h-8 lg:w-9 lg:h-9 text-[#ffd700]" />
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 text-[#d4af37] mb-2.5 font-cinzel text-[11px] font-bold tracking-[0.2em] uppercase">
                TOURNAMENT CONCLUDED
              </div>

              <h1 className="font-cinzel text-2xl sm:text-3xl font-black text-[#fdf6e2] uppercase tracking-wider drop-shadow-md">
                ALL ANCHORS DROPPED
              </h1>
              <p className="mt-3 text-sm font-garamond text-[#b8a990] max-w-md mx-auto leading-relaxed">
                The Admiral has ended the test. All submissions have been evaluated by the High Admiral AI!
              </p>

              {top3Winners.length > 0 && (
                <div className="mt-10 w-full">
                  <div className="flex items-center justify-center gap-2 mb-6 font-cinzel text-xs font-bold uppercase tracking-[0.25em] text-[#d4af37]">
                    <Crown className="w-4 h-4 text-[#ffd700]" />
                    TOP 3 FLEET CHAMPIONS
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {top3Winners.map((w, idx) => (
                      <div
                        key={idx}
                        className={`rounded-2xl p-5 text-left border ${
                          idx === 0
                            ? "bg-[#d4af37]/15 border-[#d4af37]/50 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                            : idx === 1
                            ? "bg-slate-800/40 border-slate-400/30"
                            : "bg-amber-950/30 border-amber-600/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2 font-cinzel font-bold text-xs tracking-wider">
                          <Medal className={`w-4 h-4 ${idx === 0 ? "text-[#ffd700]" : idx === 1 ? "text-slate-300" : "text-amber-600"}`} />
                          <span className={idx === 0 ? "text-[#ffd700]" : idx === 1 ? "text-slate-300" : "text-amber-600"}>
                            {idx === 0 ? "1ST PLACE" : idx === 1 ? "2ND PLACE" : "3RD PLACE"}
                          </span>
                        </div>
                        <div className="font-cinzel font-bold text-[#fdf6e2] text-sm">{w.name}</div>
                        <div className="text-xs font-garamond text-[#8e8271] mt-0.5">{w.email}</div>
                        <div className="mt-3 text-sm font-cinzel font-bold text-[#ffd700]">
                          {w.compositeScore} PTS
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/standings"
                  className="border border-[#d4af37]/60 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 font-cinzel tracking-widest text-[#d4af37] rounded-xl px-6 py-3 text-xs uppercase font-bold transition-all"
                >
                  VIEW FULL BOUNTY BOARD
                </Link>
                <Link
                  href="/dashboard"
                  className="border border-white/10 hover:border-[#d4af37]/30 bg-black/40 hover:bg-black/60 font-cinzel tracking-widest text-[#8e8271] hover:text-[#f4ede0] rounded-xl px-6 py-3 text-xs uppercase font-bold transition-all"
                >
                  RETURN TO HARBOR
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── STATE: ACTIVE CODING ARENA (Codédex-inspired Pirate Layout) ──
  return (
    <div className={`flex w-full flex-col font-sans relative z-10 text-[#f4ede0] lg:h-screen lg:max-h-screen lg:overflow-hidden ${
      isFullscreen ? "pt-2 pb-2 px-3 gap-2" : "pt-24 lg:pt-[66px] pb-3 lg:pb-2.5 px-3 lg:px-4 gap-2.5"
    }`}>

      {/* ── SECURITY HUD WARNING TOAST ─────────────────────────── */}
      {securityToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#140808]/95 border-2 border-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.6)] backdrop-blur-xl animate-bounce">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 animate-pulse" />
          <div>
            <div className="text-[10px] font-cinzel font-black tracking-[0.25em] text-red-400 uppercase">
              SECURITY PROTOCOL ENFORCEMENT
            </div>
            <div className="text-xs font-garamond text-[#f4ede0] font-bold">
              {securityToast}
            </div>
          </div>
        </div>
      )}

      {/* ── FULLSCREEN OVERLAY ───────────────────────────────────── */}
      {needsFullscreen && (!isFullscreen || fullscreenExited) && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-3 sm:p-6 text-center overflow-hidden"
          style={{
            background: fullscreenExited
              ? "radial-gradient(ellipse at center, rgba(30,5,5,0.96) 0%, rgba(10,0,0,0.98) 70%)"
              : "radial-gradient(ellipse at center, rgba(12,18,32,0.95) 0%, rgba(5,8,16,0.98) 70%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Ambient orb */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
            style={{
              background: fullscreenExited
                ? "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)",
              animation: "orbPulse 3s ease-in-out infinite",
            }}
          />

          {/* Tactical Coordinates Header */}
          <div className="relative z-10 mb-2.5 lg:mb-2 flex items-center gap-2 text-[10px] font-cinzel font-bold tracking-[0.3em] uppercase">
            <span className={`w-1.5 h-1.5 rounded-full ${fullscreenExited ? "bg-red-400" : "bg-[#d4af37]"}`} />
            <span className={fullscreenExited ? "text-red-400/80" : "text-[#d4af37]/80"}>
              {fullscreenExited ? "ADMIRALTY COURT MARTIAL · CODE OF THE HIGH SEAS" : "BATTLE PROTOCOL · SECURE ARENA ENTRY"}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${fullscreenExited ? "bg-red-400" : "bg-[#d4af37]"}`} />
          </div>

          <div className="relative z-10 w-full max-w-xl animate-treasure-in max-h-[96vh] lg:max-h-[92vh] flex flex-col">
            {fullscreenExited ? (
              /* ── PERMANENT LOCKOUT SCREEN (MAROONED) ── */
              <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-red-500/40 via-[#d4af37]/20 to-red-500/35 p-[1px] shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(239,68,68,0.15)] flex flex-col min-h-0">
                <Spotlight className="from-red-500/30 via-[#d4af37]/20 to-transparent blur-3xl opacity-35" size={450} />

                <div className="relative w-full rounded-[2.5rem] bg-[#120a0a]/94 backdrop-blur-2xl p-5 sm:p-7 lg:p-5 border border-red-500/20 flex flex-col items-center text-center overflow-y-auto scrollbar-none">
                  {/* Corner brackets */}
                  <span className="pointer-events-none absolute top-4 left-4 w-3.5 h-3.5 border-t-2 border-l-2 border-red-500/60" />
                  <span className="pointer-events-none absolute top-4 right-4 w-3.5 h-3.5 border-t-2 border-r-2 border-red-500/60" />
                  <span className="pointer-events-none absolute bottom-4 left-4 w-3.5 h-3.5 border-b-2 border-l-2 border-red-500/60" />
                  <span className="pointer-events-none absolute bottom-4 right-4 w-3.5 h-3.5 border-b-2 border-r-2 border-red-500/60" />

                  {/* Skull Crest Medallion */}
                  <div className="relative mb-3 lg:mb-2.5 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-red-500" />
                    <div className="absolute -inset-2.5 rounded-full border border-dashed border-red-500/40 animate-[spin_40s_linear_infinite]" />
                    <div className="absolute -inset-1 rounded-full border border-red-500/30" />

                    <div
                      className="relative flex h-16 w-16 lg:h-16 lg:w-16 items-center justify-center rounded-2xl shadow-[0_0_35px_rgba(239,68,68,0.3)] border-2 border-red-500/60"
                      style={{
                        background: "radial-gradient(circle at 30% 30%, #260808 0%, #0d0202 75%)",
                      }}
                    >
                      <Skull className="w-8 h-8 lg:w-9 lg:h-9 text-red-400 drop-shadow-[0_2px_12px_rgba(239,68,68,0.7)]" strokeWidth={1.75} />
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-red-500/50 bg-red-950/50 text-red-400 mb-2.5 font-cinzel text-[11px] font-bold tracking-[0.2em] uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    DISQUALIFIED FROM THIS ROUND
                  </div>

                  {/* Headline */}
                  <h1 className="font-cinzel text-2xl sm:text-3xl lg:text-2xl font-black text-[#fdf6e2] uppercase tracking-[0.08em] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                    {dqReason === "TAB_SWITCH" ? "MUTINY DETECTED!" : "MAROONED!"}
                  </h1>

                  {/* Subtle Ornamental Crimson Divider */}
                  <div className="flex items-center justify-center gap-3 my-2 w-full max-w-xs opacity-75">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-red-500 to-red-500/40" />
                    <div className="w-1.5 h-1.5 rotate-45 border border-red-500 bg-red-500/40" />
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-red-500 to-red-500/40" />
                  </div>

                  <p className="font-garamond text-xs sm:text-sm lg:text-xs text-[#c8b887] leading-relaxed max-w-lg mx-auto">
                    {dqReason === "TAB_SWITCH"
                      ? "You switched tabs or minimized the arena window during an active battle."
                      : "You exited fullscreen during an active battle."}{" "}
                    All questions in this round have been{" "}
                    <strong className="text-red-400 font-bold">automatically submitted</strong> to the High Admiral. You cannot attempt any more questions in this round.
                  </p>

                  {/* Status Dossier Card */}
                  <div className="w-full rounded-xl border border-red-500/30 bg-[#1e0a0a]/80 backdrop-blur-md p-3 lg:p-2.5 text-center mt-3 shadow-[inset_0_1px_0_rgba(239,68,68,0.15)]">
                    <Anchor className="w-5 h-5 text-red-400 mx-auto mb-1 opacity-80" />
                    <p className="text-[11px] lg:text-[10px] font-cinzel font-bold text-red-400 tracking-[0.2em] uppercase">
                      {autoSubmitDone ? "ALL QUESTIONS AUTO-SUBMITTED" : "TRANSMITTING SCROLLS TO ADMIRAL..."}
                    </p>
                    <p className="text-[11px] font-garamond text-[#a09483] mt-0.5 leading-relaxed">
                      {autoSubmitDone
                        ? "All your answer scrolls have been sealed and logged in the Fleet Registry. Wait for the round to end."
                        : "Dispatching your answer scrolls to the Admiral's flagship..."}
                    </p>
                  </div>

                  {/* Action Navigation Buttons */}
                  <div className="mt-3.5 flex flex-wrap justify-center gap-2.5 w-full">
                    <Link
                      href="/standings"
                      className="border border-[#d4af37]/60 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 font-cinzel tracking-widest text-[#d4af37] rounded-xl px-5 py-2 text-[11px] uppercase font-bold transition-all shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                    >
                      VIEW BOUNTY BOARD
                    </Link>
                    <Link
                      href="/dashboard"
                      className="border border-white/10 hover:border-[#d4af37]/30 bg-black/40 hover:bg-black/60 font-cinzel tracking-widest text-[#8e8271] hover:text-[#f4ede0] rounded-xl px-5 py-2 text-[11px] uppercase font-bold transition-all"
                    >
                      RETURN TO HARBOR
                    </Link>
                  </div>

                  <p className="text-[9px] font-cinzel text-[#695e50] tracking-widest uppercase mt-2.5">
                    THE ROUND CONTINUES FOR OTHER PIRATES · RESULTS WILL BE SHOWN AT SESSION CLOSE
                  </p>
                </div>
              </div>
            ) : (
              /* ── INITIAL FULLSCREEN REQUEST ── */
              <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#d4af37]/35 via-[#d4af37]/15 to-[#d4af37]/30 p-[1px] shadow-[0_25px_80px_rgba(0,0,0,0.85)] flex flex-col min-h-0">
                <Spotlight className="from-[#f4ede0] via-[#d4af37] to-transparent blur-3xl opacity-35" size={450} />

                <div className="relative w-full rounded-[2.5rem] bg-[#121620]/92 backdrop-blur-2xl p-5 sm:p-7 lg:p-5 border border-[#d4af37]/15 flex flex-col items-center text-center overflow-y-auto scrollbar-none">
                  {/* Corner brackets */}
                  <span className="pointer-events-none absolute top-4 left-4 w-3.5 h-3.5 border-t-2 border-l-2 border-[#d4af37]/50" />
                  <span className="pointer-events-none absolute top-4 right-4 w-3.5 h-3.5 border-t-2 border-r-2 border-[#d4af37]/50" />
                  <span className="pointer-events-none absolute bottom-4 left-4 w-3.5 h-3.5 border-b-2 border-l-2 border-[#d4af37]/50" />
                  <span className="pointer-events-none absolute bottom-4 right-4 w-3.5 h-3.5 border-b-2 border-r-2 border-[#d4af37]/50" />

                  {/* Ship Crest Medallion */}
                  <div className="relative mb-3 lg:mb-2.5 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#d4af37]" />
                    <div className="absolute -inset-2.5 rounded-full border border-dashed border-[#d4af37]/30 animate-[spin_40s_linear_infinite]" />
                    <div className="absolute -inset-1 rounded-full border border-[#d4af37]/20" />

                    <div
                      className="relative flex h-16 w-16 lg:h-16 lg:w-16 items-center justify-center rounded-2xl shadow-[0_0_35px_rgba(212,175,55,0.25)] border-2 border-[#d4af37]/60"
                      style={{
                        background: "radial-gradient(circle at 30% 30%, #1e293b 0%, #0a0f1d 75%)",
                      }}
                    >
                      <Ship className="w-8 h-8 lg:w-9 lg:h-9 text-[#ffd700] drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)]" strokeWidth={1.75} />
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37] mb-2.5 font-cinzel text-[11px] font-bold tracking-[0.2em] uppercase">
                    <Swords className="w-3.5 h-3.5 text-[#d4af37]" />
                    BATTLE STATIONS · ACTION REQUIRED
                  </div>

                  {/* Headline */}
                  <h1 className="font-cinzel text-2xl sm:text-3xl lg:text-2xl font-black text-[#fdf6e2] uppercase tracking-[0.08em] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                    ENTER FULLSCREEN
                  </h1>

                  {/* Subtle Ornamental Gold Divider */}
                  <div className="flex items-center justify-center gap-3 my-2 w-full max-w-xs opacity-75">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#d4af37] to-[#d4af37]/40" />
                    <div className="w-1.5 h-1.5 rotate-45 border border-[#d4af37] bg-[#d4af37]/40" />
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#d4af37] to-[#d4af37]/40" />
                  </div>

                  <p className="font-garamond text-xs sm:text-sm lg:text-xs text-[#c8b887] leading-relaxed max-w-lg mx-auto">
                    The Captain has started the round! You must enter{" "}
                    <strong className="text-[#d4af37]">fullscreen mode</strong> to access the coding arena. Exiting fullscreen, switching tabs, or cutting/copying/pasting will{" "}
                    <strong className="text-red-400">permanently lock you out</strong> and auto-submit all questions in this round.
                  </p>

                  <button
                    onClick={enterFullscreen}
                    className="mt-3.5 flex items-center justify-center gap-2.5 border border-[#d4af37]/60 bg-gradient-to-r from-[#d4af37]/20 via-[#ffd700]/25 to-[#d4af37]/20 hover:from-[#d4af37]/35 hover:to-[#ffd700]/40 font-cinzel text-[#f4ede0] w-full rounded-2xl py-3 text-xs sm:text-sm font-bold tracking-[0.25em] uppercase transition-all shadow-[0_0_30px_rgba(212,175,55,0.2)]"
                  >
                    <Maximize2 className="w-4 h-4 text-[#ffd700]" />
                    HOIST THE SAILS — ENTER FULLSCREEN
                  </button>

                  <p className="text-[9px] font-cinzel text-[#695e50] tracking-widest uppercase mt-2">
                    PRESS F11 OR CLICK ABOVE · EXITING FULLSCREEN OR SWITCHING TABS = PERMANENT LOCKOUT
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      
      {/* ── MAIN IDE WORKSPACE ────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden w-full max-w-[1920px] mx-auto gap-2.5 lg:gap-3">
        
        {/* ── LEFT: Problem Panel (Exercise) ──────────────────────── */}
        <div className="relative w-full lg:w-[36%] xl:w-[30%] min-h-0 h-full overflow-hidden rounded-2xl bg-[#d4af37]/10 p-[1px] shadow-2xl flex flex-col select-none">
          <div className="relative flex-1 min-h-0 flex flex-col bg-[#1a1714]/70 backdrop-blur-lg rounded-2xl border border-[#d4af37]/20 overflow-hidden select-none">
            {/* Header */}
            <div className="flex items-center px-4 py-2.5 border-b border-[#d4af37]/20 bg-[#d4af37]/5 select-none shrink-0">
              <span className="text-[10px] font-cinzel font-bold uppercase tracking-[0.2em] text-[#d4af37]">Mission Briefing</span>
            </div>
            
            {currentQuestion ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-5 scrollbar-thin scrollbar-thumb-[#d4af37]/30 select-none">
                <div className="mb-4">
                  <h2 className="text-2xl lg:text-3xl font-cinzel font-bold text-[#f4ede0] mb-2 leading-tight drop-shadow-md">
                    {String(selectedQuestionIndex + 1).padStart(2, '0')}. {currentQuestion.title}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-[#d4af37]/10 border border-[#d4af37]/30 px-2 py-0.5 text-xs font-bold font-garamond text-[#d4af37]">
                      {currentQuestion.points} BOUNTY PTS
                    </span>
                    {isQuestionSubmitted && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-900/40 border border-emerald-500/40 px-2 py-0.5 text-xs font-bold font-garamond text-emerald-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        SUBMITTED
                      </span>
                    )}
                  </div>
                </div>

                <div className="prose prose-base lg:prose-lg font-garamond max-w-none prose-p:text-[#f4ede0]/80 prose-headings:text-[#d4af37] prose-headings:font-cinzel prose-pre:bg-[#1a1714]/50 prose-pre:border prose-pre:border-[#d4af37]/20 prose-code:text-[#d4af37] leading-relaxed select-none">
                  <ReactMarkdown>{currentQuestion.description}</ReactMarkdown>
                </div>

                {currentQuestion.testCases?.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[#d4af37]/20 select-none">
                    <h4 className="text-[10px] font-cinzel font-bold uppercase tracking-[0.2em] text-[#d4af37] mb-3">
                      Test Vectors
                    </h4>
                    <div className="space-y-2.5">
                      {currentQuestion.testCases.map((tc, i) => (
                        <div key={i} className="rounded-xl p-3 text-xs font-mono bg-[#1a1714]/60 border border-[#d4af37]/10 select-none">
                          <div className="text-[#f4ede0]/60 mb-1">
                            Input: <span className="text-[#f4ede0]">{tc.input}</span>
                          </div>
                          <div className="text-[#f4ede0]/60">
                            Expected: <span className="text-[#d4af37]">{tc.expected}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#f4ede0]/60 font-garamond text-lg select-none">
                No question selected.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Editor & Terminal ───────────────────────────── */}
        <div className="flex-1 min-h-0 h-full flex flex-col gap-2.5 lg:gap-3 overflow-hidden">
          
          {/* EDITOR PANEL */}
          <div className="relative flex-[3] min-h-[160px] overflow-hidden rounded-2xl bg-[#d4af37]/10 p-[1px] shadow-2xl flex flex-col">
            <div className="relative flex-1 min-h-0 flex flex-col bg-[#1a1714]/70 backdrop-blur-lg rounded-2xl border border-[#d4af37]/20 overflow-hidden">
              
              {/* Editor Header */}
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#d4af37]/20 bg-[#d4af37]/5 select-none shrink-0">
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-[#1a1714] text-[#d4af37] text-xs font-cinzel font-bold uppercase tracking-wider outline-none cursor-pointer border border-[#d4af37]/30 rounded px-2 py-0.5 hover:border-[#d4af37]/60 transition-colors"
                  >
                    <option value="c" className="bg-[#1a1714] text-[#f4ede0]">C (GCC)</option>
                    <option value="cpp" className="bg-[#1a1714] text-[#f4ede0]">C++ (G++ 20)</option>
                    <option value="java" className="bg-[#1a1714] text-[#f4ede0]">Java (OpenJDK 22)</option>
                    <option value="python" className="bg-[#1a1714] text-[#f4ede0]">Python 3</option>
                    <option value="javascript" className="bg-[#1a1714] text-[#f4ede0]">JavaScript (Node.js)</option>
                  </select>

                  <button
                    onClick={handleResetToStarterCode}
                    title="Reset editor code to official startup code for this challenge"
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-cinzel font-bold text-[#d4af37]/75 hover:text-[#ffd700] border border-[#d4af37]/20 hover:border-[#d4af37]/50 bg-[#d4af37]/5 hover:bg-[#d4af37]/15 transition-all"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span className="hidden sm:inline">RESET STARTER</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" : "bg-red-500"}`} />
                  <span className="text-[10px] font-cinzel font-bold text-[#f4ede0]/60 uppercase tracking-widest hidden sm:block">
                    {connected ? "LIVE SYNC" : "OFFLINE"}
                  </span>
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 min-h-0 relative overflow-hidden">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={language === "cpp" ? "cpp" : language === "c" ? "c" : language === "java" ? "java" : language === "python" ? "python" : "javascript"}
                  value={currentCode}
                  onChange={handleCodeChange}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                    fontLigatures: true,
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: true,
                    renderLineHighlight: "none",
                    contextmenu: false,
                    copyWithSyntaxHighlighting: false,
                    selectionClipboard: false,
                  }}
                  className="bg-transparent"
                />
              </div>
              
            </div>
          </div>

          {/* TERMINAL PANEL */}
          <div className="relative flex-[1.1] min-h-[85px] max-h-[220px] overflow-hidden rounded-2xl bg-[#d4af37]/10 p-[1px] shadow-2xl flex flex-col select-none">
            <div className="relative flex-1 min-h-0 flex flex-col bg-[#1a1714]/70 backdrop-blur-lg rounded-2xl border border-[#d4af37]/20 select-none overflow-hidden">
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#d4af37]/20 bg-[#d4af37]/5 select-none shrink-0">
                <span className="text-[10px] font-cinzel font-bold uppercase tracking-[0.2em] text-[#f4ede0]/60">
                  Terminal
                </span>
                <button
                  onClick={() => setOutput("")}
                  className="text-[10px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37] hover:text-[#f4ede0] transition-colors"
                >
                  Clear Output
                </button>
              </div>
              <pre className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5 whitespace-pre-wrap font-mono text-xs sm:text-sm text-[#f4ede0]/80 leading-relaxed scrollbar-thin scrollbar-thumb-[#d4af37]/30">
                {output || (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-[#f4ede0]/60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50">
                      <polyline points="4 17 10 11 4 5"></polyline>
                      <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                    <span className="font-garamond text-base italic">Awaiting execution...</span>
                  </div>
                )}
              </pre>
            </div>
          </div>
          
        </div>
      </div>

      {/* ── BOTTOM NAV BAR (Footer) ────────────────────────────── */}
      <div className="flex-shrink-0 w-full max-w-[1920px] mx-auto h-12 lg:h-13 rounded-2xl bg-[#1a1714]/80 backdrop-blur-lg border border-[#d4af37]/30 shadow-2xl flex items-center justify-between px-4 lg:px-6">
        
        {/* Left: Questions Tabs */}
        <div className="flex items-center gap-2">
          <div className="mr-4 flex items-center gap-2 text-[#d4af37]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            <span className="font-cinzel font-bold text-sm tracking-widest uppercase hidden sm:block">
              {round?.name || "The Trial"}
            </span>
          </div>
          <div className="h-6 w-[1px] bg-[#d4af37]/20 mr-4" />
          
          <div className="flex gap-2">
            {round?.questions.map((q, idx) => {
              const isSelected = idx === selectedQuestionIndex
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQuestionIndex(idx)
                    setOutput("")
                    const targetQ = round?.questions[idx]
                    if (targetQ) {
                      const langKey = `${targetQ.id}_${language.toLowerCase()}`
                      if (!codes[langKey] && !codes[targetQ.id]) {
                        const starter = getQuestionStarterCode(targetQ, language)
                        setCodes((prev) => ({
                          ...prev,
                          [langKey]: starter,
                          [targetQ.id]: starter
                        }))
                      }
                    }
                  }}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-cinzel font-bold transition-all ${
                    isSelected
                      ? "bg-[#d4af37] text-[#1a1714] shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                      : "bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#d4af37]/20"
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-cinzel font-bold text-[#f4ede0]/60 tracking-widest mr-2 uppercase">
            Attempts: <span className={currentAttempts >= maxAttempts ? "text-red-500" : "text-[#d4af37]"}>{currentAttempts}/{maxAttempts}</span>
          </div>
          
          <button
            onClick={handleCompile}
            disabled={isCompiling || isSubmitting || currentAttempts >= maxAttempts}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/40 text-[#d4af37] font-cinzel font-bold text-xs tracking-widest uppercase hover:bg-[#d4af37]/20 transition-all disabled:border-[#d4af37]/20 disabled:bg-[#d4af37]/5 disabled:text-[#d4af37]/80 disabled:cursor-not-allowed"
          >
            {isCompiling ? (
              <span className="w-3 h-3 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
            Run Code
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={isCompiling || isSubmitting}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#d4af37] text-[#1a1714] font-cinzel font-bold text-xs tracking-widest uppercase hover:bg-[#c8b887] transition-all disabled:bg-[#d4af37]/80 disabled:text-[#1a1714]/80 disabled:shadow-none disabled:cursor-not-allowed shadow-[0_0_15px_rgba(212,175,55,0.4)]"
          >
            {isSubmitting ? (
              <span className="w-3 h-3 border-2 border-[#1a1714] border-t-transparent rounded-full animate-spin" />
            ) : null}
            Submit Answer
          </button>
        </div>
        
      </div>

      {/* ── ATTEMPT EXCEEDED MODAL ────────────────────────────── */}
      {attemptErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-red-500/20 p-[2px] shadow-2xl">
            <div className="relative w-full h-full rounded-[2rem] bg-[#1a1714]/90 backdrop-blur-md p-8 text-center border border-red-500/30 flex flex-col items-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" className="mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"></path>
              </svg>
              <h3 className="text-xl font-cinzel font-bold text-red-400 tracking-wider">ATTEMPT LIMIT EXHAUSTED</h3>
              <p className="mt-3 text-sm font-garamond text-[#f4ede0]/70 leading-relaxed">{attemptErrorModal}</p>
              <button
                onClick={() => setAttemptErrorModal(null)}
                className="mt-6 w-full rounded-xl py-3 border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-cinzel font-bold tracking-widest uppercase transition-all"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
