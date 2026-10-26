export const CODE_LANGUAGE = "c"
export const SUPPORTED_LANGUAGES = ["c", "cpp", "java"] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  "c++": "cpp",
}

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((supportedLanguage) => supportedLanguage === language)
}

export const C_STARTER_CODE = `#include <stdio.h>

int main(void) {
    // Read input, process the problem, and print the result.
    return 0;
}
`

export function assertSupportedLanguage(language: string): void {
  normalizeSupportedLanguage(language)
}

export function normalizeSupportedLanguage(language: string): SupportedLanguage {
  const normalizedLanguage = language.trim().toLowerCase()
  const aliasedLanguage = Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, normalizedLanguage)
    ? LANGUAGE_ALIASES[normalizedLanguage]
    : undefined
  if (aliasedLanguage) return aliasedLanguage

  const supportedLanguage = SUPPORTED_LANGUAGES.find((candidate) => candidate === normalizedLanguage)
  if (supportedLanguage) return supportedLanguage

  throw new Error(`Unsupported language: ${language}. Supported languages are C, C++, and Java.`)
}
