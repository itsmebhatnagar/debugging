export const SUPPORTED_LANGUAGES = [
  "c",
  "cpp",
  "java",
  "python",
  "javascript",
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const CODE_LANGUAGE = "c"

export const C_STARTER_CODE = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    char input[4096];
    if (fgets(input, sizeof(input), stdin)) {
        input[strcspn(input, "\\r\\n")] = 0;
        // Process problem and print output
        printf("%s\\n", input);
    }
    return 0;
}
`

export const CPP_STARTER_CODE = `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string line;
    if (getline(cin, line)) {
        // Process problem and print output
        cout << line << "\\n";
    }
    return 0;
}
`

export const JAVA_STARTER_CODE = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line != null) {
            // Process problem and print output
            System.out.println(line);
        }
    }
}
`

export function normalizeLanguage(language: string): string {
  const norm = (language || "").toLowerCase().trim()
  if (norm === "c++" || norm === "cpp") return "cpp"
  if (norm === "c") return "c"
  if (norm === "java") return "java"
  if (norm === "python" || norm === "py" || norm === "python3") return "python"
  if (norm === "javascript" || norm === "js" || norm === "nodejs") return "javascript"
  return norm || "c"
}

export function assertSupportedLanguage(language: string): void {
  const norm = normalizeLanguage(language)
  const valid = ["c", "cpp", "java", "python", "javascript"]
  if (!valid.includes(norm)) {
    throw new Error(`Unsupported language: '${language}'. Supported compilers: C (GCC), C++ (G++), Java (OpenJDK), Python, and JavaScript.`)
  }
}
