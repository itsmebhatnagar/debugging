export const CODE_LANGUAGE = "c"

export const C_STARTER_CODE = `#include <stdio.h>

int main(void) {
    // Read input, process the problem, and print the result.
    return 0;
}
`

export function assertSupportedLanguage(language: string): void {
  if (language.toLowerCase() !== CODE_LANGUAGE) {
    throw new Error(`Unsupported language: ${language}. Only C is supported.`)
  }
}
