export const CODE_LANGUAGE = "c"
export const SUPPORTED_LANGUAGES = ["c", "cpp", "java"] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  "c++": "cpp",
}

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  const normalized = (language || "").trim().toLowerCase()
  const resolved = LANGUAGE_ALIASES[normalized] || (normalized as SupportedLanguage)
  return SUPPORTED_LANGUAGES.includes(resolved as SupportedLanguage)
}

export const C_STARTER_CODE = `#include <stdio.h>

int main(void) {
    // Read input, process the problem, and print the result.
    return 0;
}
`

export const CPP_STARTER_CODE = `#include <iostream>

using namespace std;

int main() {
    // Read input, process the problem, and print the result.
    return 0;
}
`

export const JAVA_STARTER_CODE = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        // Read input, process the problem, and print the result.
    }
}
`

export function assertSupportedLanguage(language: string): void {
  normalizeSupportedLanguage(language)
}

export function normalizeSupportedLanguage(language: string): SupportedLanguage {
  const normalizedLanguage = (language || "").trim().toLowerCase()
  const aliasedLanguage = Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, normalizedLanguage)
    ? LANGUAGE_ALIASES[normalizedLanguage]
    : undefined
  if (aliasedLanguage) return aliasedLanguage

  const supportedLanguage = SUPPORTED_LANGUAGES.find((candidate) => candidate === normalizedLanguage)
  if (supportedLanguage) return supportedLanguage

  throw new Error(`Unsupported language: ${language}. Supported languages are C, C++, and Java.`)
}

export function normalizeLanguage(language: string): string {
  try {
    return normalizeSupportedLanguage(language)
  } catch {
    return (language || "").toLowerCase().trim() || "c"
  }
}
