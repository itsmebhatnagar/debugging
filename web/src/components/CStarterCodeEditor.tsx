"use client"

import { useState } from "react"
import Editor from "@monaco-editor/react"
import { C_STARTER_CODE } from "@/lib/code-language"

export default function CStarterCodeEditor({
  initialCode = C_STARTER_CODE,
}: {
  initialCode?: string
}) {
  const [code, setCode] = useState(initialCode)

  return (
    <div className="overflow-hidden rounded-lg border border-[#8b7355]/40 bg-[#070b14]">
      <Editor
        height="260px"
        language="c"
        theme="vs-dark"
        value={code}
        onChange={(value) => setCode(value ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          padding: { top: 12 },
        }}
      />
      <input type="hidden" name="cStarter" value={code} />
    </div>
  )
}
