import { prisma } from "@/lib/prisma"
import { C_STARTER_CODE, CODE_LANGUAGE } from "@/lib/code-language"

export async function seedPirateChampionship() {
  console.log(" Seeding Pirate Code Championship...")

  // 1. Find or create the flagship Championship
  let competition = await prisma.competition.findFirst({
    where: { name: "Echona 2K26 - Pirate Code Championship" },
    include: { rounds: true }
  })

  if (!competition) {
    competition = await prisma.competition.create({
      data: {
        name: "Echona 2K26 - Pirate Code Championship",
        description: "The premier algorithmic pirate tournament. 3 grueling trials of logic, strategy, and code mastery!",
        status: "WAITING",
      },
      include: { rounds: true }
    })
  } else {
    // Reset status to WAITING if seeding
    await prisma.competition.update({
      where: { id: competition.id },
      data: { status: "WAITING", startedAt: null }
    })

    // Wipe all previous participant attempts so they get a fresh start
    const rounds = await prisma.round.findMany({
      where: { competitionId: competition.id },
      select: { id: true, questions: { select: { id: true } } }
    })
    
    const questionIds = rounds.flatMap(r => r.questions.map(q => q.id))

    if (questionIds.length > 0) {
      await prisma.compileAttempt.deleteMany({ where: { questionId: { in: questionIds } } })
      await prisma.submission.deleteMany({ where: { questionId: { in: questionIds } } })
      await prisma.draftCode.deleteMany({ where: { questionId: { in: questionIds } } })
    }
  }

  // Ensure all registered real users are enrolled as participants
  let realUsers = await prisma.user.findMany({
    where: { role: "USER" }
  })

  if (realUsers.length === 0) {
    const samplePirates = [
      { email: "jack.sparrow@echona.com", name: "Captain Jack Sparrow", mobile: "+91 9876543210" },
      { email: "will.turner@echona.com", name: "Will Turner", mobile: "+91 9876543211" },
      { email: "elizabeth.swann@echona.com", name: "Elizabeth Swann", mobile: "+91 9876543212" },
      { email: "hector.barbossa@echona.com", name: "Hector Barbossa", mobile: "+91 9876543213" },
    ]
    for (const p of samplePirates) {
      await prisma.user.upsert({
        where: { email: p.email },
        update: {},
        create: {
          email: p.email,
          name: p.name,
          mobile: p.mobile,
          role: "USER"
        }
      })
    }
    realUsers = await prisma.user.findMany({ where: { role: "USER" } })
  }

  for (let i = 0; i < realUsers.length; i++) {
    const u = realUsers[i]
    const initialStatus = i === 1 ? "QUALIFIED" : i === 3 ? "DISQUALIFIED" : "WAITING"
    await prisma.competitionParticipant.upsert({
      where: {
        competitionId_userId: {
          competitionId: competition.id,
          userId: u.id
        }
      },
      update: { score: 0 },
      create: {
        competitionId: competition.id,
        userId: u.id,
        score: 0,
        status: initialStatus
      }
    })
  }

  // 3. Configure Round 1: Quest for the Lost Treasure
  // 3 questions, 25 minutes (1500s), 5 compile attempts
  let round1 = await prisma.round.findFirst({
    where: { competitionId: competition.id, order: 1 }
  })

  if (!round1) {
    round1 = await prisma.round.create({
      data: {
        competitionId: competition.id,
        name: "Quest for the Lost Treasure",
        order: 1,
        durationSeconds: 25 * 60, // 25 minutes
        maxCompileAttempts: 5,
        status: "PENDING"
      }
    })
  } else {
    await prisma.round.update({
      where: { id: round1.id },
      data: {
        name: "Quest for the Lost Treasure",
        durationSeconds: 25 * 60,
        maxCompileAttempts: 5,
        status: "PENDING"
      }
    })
  }

  // Round 1 - Question 1
  await createOrUpdateQuestion(round1.id, {
    title: "The Lost Island Coordinates",
    description: `###  Mission Briefing
The navigator found an ancient maritime chart with coded bearing numbers. Write a C program that reads space-separated integers from standard input and prints the largest value (or \`0\` if there are no values).

### Input Format:
A single string of space-separated integers representing oceanic depths, e.g. \`"12 45 89 23 67"\`.

### Output Format:
The highest integer value found, or return \`0\` if empty.

`,
    points: 100,
    starterCodes: {
      c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int num, maxVal = 0;
    while (scanf("%d", &num) == 1) {
        if (num > maxVal) {
            maxVal = num;
        }
    }
    printf("%d", maxVal);
    return 0;
}
`,
      cpp: `#include <iostream>
#include <algorithm>

using namespace std;

int main() {
    int num, maxVal = 0;
    while (cin >> num) {
        maxVal = max(maxVal, num);
    }
    cout << maxVal;
    return 0;
}
`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int maxVal = 0;
        while (scanner.hasNextInt()) {
            int num = scanner.nextInt();
            if (num > maxVal) {
                maxVal = num;
            }
        }
        System.out.print(maxVal);
    }
}
`,
      javascript: `function findCoordinates(bearings) {
  if (!bearings || bearings.trim().length === 0) return 0;
  const numbers = bearings.trim().split(/\\s+/).map(Number);
  return Math.max(...numbers);
}
`,
      python: `def find_coordinates(bearings: str) -> int:
    if not bearings or not bearings.strip():
        return 0
    nums = [int(x) for x in bearings.split()]
    return max(nums)
`
    },
    testCases: [
      { input: "10 50 30", expected: "50", isHidden: false },
      { input: "100 200 50", expected: "200", isHidden: false },
      { input: "7 99 43 12", expected: "99", isHidden: true }
    ]
  })

  // Round 1 - Question 2
  await createOrUpdateQuestion(round1.id, {
    title: "Deciphering Blackbeard's Cipher",
    description: `###  Mission Briefing
Blackbeard encrypted his orders by shifting every alphabetical character backward by 1 position (e.g., 'B' -> 'A', 'a' -> 'z', 'A' -> 'Z').
Write a C program that reads the encoded text from standard input and prints the decoded text.

### Input:
A string with encoded text.

### Output:
The decoded plaintext string.
`,
    points: 150,
    starterCodes: {
      c: `#include <stdio.h>
#include <string.h>

int main() {
    char s[1024];
    if (scanf("%s", s) == 1) {
        for (int i = 0; s[i] != '\\0'; i++) {
            if (s[i] >= 'a' && s[i] <= 'z') {
                s[i] = (s[i] == 'a') ? 'z' : s[i] - 1;
            } else if (s[i] >= 'A' && s[i] <= 'Z') {
                s[i] = (s[i] == 'A') ? 'Z' : s[i] - 1;
            }
        }
        printf("%s", s);
    }
    return 0;
}
`,
      cpp: `#include <iostream>
#include <string>

using namespace std;

int main() {
    string s;
    if (cin >> s) {
        for (char &c : s) {
            if (c >= 'a' && c <= 'z') {
                c = (c == 'a') ? 'z' : c - 1;
            } else if (c >= 'A' && c <= 'Z') {
                c = (c == 'A') ? 'Z' : c - 1;
            }
        }
        cout << s;
    }
    return 0;
}
`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNext()) {
            String s = scanner.next();
            StringBuilder sb = new StringBuilder();
            for (char c : s.toCharArray()) {
                if (c >= 'a' && c <= 'z') {
                    sb.append(c == 'a' ? 'z' : (char)(c - 1));
                } else if (c >= 'A' && c <= 'Z') {
                    sb.append(c == 'A' ? 'Z' : (char)(c - 1));
                } else {
                    sb.append(c);
                }
            }
            System.out.print(sb.toString());
        }
    }
}
`,
      javascript: `function decipher(cipherText) {
  return cipherText.split('').map(char => {
    if (/[a-z]/.test(char)) {
      return char === 'a' ? 'z' : String.fromCharCode(char.charCodeAt(0) - 1);
    }
    if (/[A-Z]/.test(char)) {
      return char === 'A' ? 'Z' : String.fromCharCode(char.charCodeAt(0) - 1);
    }
    return char;
  }).join('');
}
`,
      python: `def decipher(cipher_text: str) -> str:
    res = []
    for c in cipher_text:
        if 'a' <= c <= 'z':
            res.append('z' if c == 'a' else chr(ord(c) - 1))
        elif 'A' <= c <= 'Z':
            res.append('Z' if c == 'A' else chr(ord(c) - 1))
        else:
            res.append(c)
    return "".join(res)
`
    },
    testCases: [
      { input: "IFMMP", expected: "HELLO", isHidden: false },
      { input: "QJSBUF", expected: "PIRATE", isHidden: false },
      { input: "USFBTVSF", expected: "TREASURE", isHidden: true }
    ]
  })

  // Round 1 - Question 3
  await createOrUpdateQuestion(round1.id, {
    title: "Distribute the Cursed Doubloons",
    description: `###  Mission Briefing
Captain Jack must split a chest containing $N$ golden doubloons equally among $K$ crew members. Any leftover doubloons are thrown into the ocean to appease Poseidon.
Write a C program that reads \`N K\` from standard input and prints \`"Each: X, Sacrificed: Y"\`.

### Output:
Return \`"Each: X, Sacrificed: Y"\`.
`,
    points: 200,
    starterCodes: {
      c: `#include <stdio.h>

int main() {
    int n, k;
    if (scanf("%d %d", &n, &k) == 2) {
        if (k <= 0) {
            printf("Each: 0, Sacrificed: 0");
        } else {
            printf("Each: %d, Sacrificed: %d", n / k, n % k);
        }
    }
    return 0;
}
`,
      cpp: `#include <iostream>

using namespace std;

int main() {
    int n, k;
    if (cin >> n >> k) {
        if (k <= 0) {
            cout << "Each: 0, Sacrificed: 0";
        } else {
            cout << "Each: " << (n / k) << ", Sacrificed: " << (n % k);
        }
    }
    return 0;
}
`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int n = scanner.nextInt();
            int k = scanner.nextInt();
            if (k <= 0) {
                System.out.print("Each: 0, Sacrificed: 0");
            } else {
                System.out.print("Each: " + (n / k) + ", Sacrificed: " + (n % k));
            }
        }
    }
}
`,
      javascript: `function distributeDoubloons(input) {
  const [n, k] = input.split(' ').map(Number);
  if (k <= 0) return "Each: 0, Sacrificed: 0";
  const each = Math.floor(n / k);
  const sac = n % k;
  return \`Each: \${each}, Sacrificed: \${sac}\`;
}
`,
      python: `def distribute_doubloons(input_str: str) -> str:
    n, k = map(int, input_str.split())
    each = n // k
    sac = n % k
    return f"Each: {each}, Sacrificed: {sac}"
`
    },
    testCases: [
      { input: "100 3", expected: "Each: 33, Sacrificed: 1", isHidden: false },
      { input: "50 5", expected: "Each: 10, Sacrificed: 0", isHidden: false },
      { input: "77 4", expected: "Each: 19, Sacrificed: 1", isHidden: true }
    ]
  })

  // 4. Configure Round 2: The Kraken’s Trial
  // 2 questions, 20 minutes (1200s), 3 compile attempts
  let round2 = await prisma.round.findFirst({
    where: { competitionId: competition.id, order: 2 }
  })

  if (!round2) {
    round2 = await prisma.round.create({
      data: {
        competitionId: competition.id,
        name: "The Kraken’s Trial",
        order: 2,
        durationSeconds: 20 * 60, // 20 minutes
        maxCompileAttempts: 3,
        status: "PENDING"
      }
    })
  } else {
    await prisma.round.update({
      where: { id: round2.id },
      data: {
        name: "The Kraken’s Trial",
        durationSeconds: 20 * 60,
        maxCompileAttempts: 3,
        status: "PENDING"
      }
    })
  }

  // Round 2 - Question 1
  await createOrUpdateQuestion(round2.id, {
    title: "Escape the Kraken's Whirlpool",
    description: `###  The Trial of the Abyss
The Kraken has formed a whirlpool of radius $R$ nautical leagues. For every nautical league your vessel travels, it burns $F$ barrels of rum fuel. If fuel remaining drops below 0 before escaping, the ship sinks!
Write a C program that reads \`Distance Fuel BurnRate\` from standard input and prints \`"ESCAPED with X fuel left"\` or \`"SUNKEN"\`.
`,
    points: 250,
    starterCodes: {
      c: `#include <stdio.h>

int main() {
    int dist, fuel, burn;
    if (scanf("%d %d %d", &dist, &fuel, &burn) == 3) {
        int needed = dist * burn;
        if (fuel >= needed) {
            printf("ESCAPED with %d fuel left", fuel - needed);
        } else {
            printf("SUNKEN");
        }
    }
    return 0;
}
`,
      cpp: `#include <iostream>

using namespace std;

int main() {
    int dist, fuel, burn;
    if (cin >> dist >> fuel >> burn) {
        int needed = dist * burn;
        if (fuel >= needed) {
            cout << "ESCAPED with " << (fuel - needed) << " fuel left";
        } else {
            cout << "SUNKEN";
        }
    }
    return 0;
}
`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int dist = scanner.nextInt();
            int fuel = scanner.nextInt();
            int burn = scanner.nextInt();
            int needed = dist * burn;
            if (fuel >= needed) {
                System.out.print("ESCAPED with " + (fuel - needed) + " fuel left");
            } else {
                System.out.print("SUNKEN");
            }
        }
    }
}
`,
      javascript: `function escapeWhirlpool(input) {
  const [dist, fuel, burn] = input.split(' ').map(Number);
  const needed = dist * burn;
  if (fuel >= needed) {
    return \`ESCAPED with \${fuel - needed} fuel left\`;
  }
  return "SUNKEN";
}
`,
      python: `def escape_whirlpool(input_str: str) -> str:
    dist, fuel, burn = map(int, input_str.split())
    needed = dist * burn
    if fuel >= needed:
        return f"ESCAPED with {fuel - needed} fuel left"
    return "SUNKEN"
`
    },
    testCases: [
      { input: "10 50 4", expected: "ESCAPED with 10 fuel left", isHidden: false },
      { input: "20 50 3", expected: "SUNKEN", isHidden: false },
      { input: "15 60 4", expected: "ESCAPED with 0 fuel left", isHidden: true }
    ]
  })

  // Round 2 - Question 2
  await createOrUpdateQuestion(round2.id, {
    title: "Targeting the Monster's Core",
    description: `###  Weak Points Calculation
Given an array of tentacle resistance values, calculate the sum of all prime values to strike the monster's vital core.
Write a C program that reads space-separated integers from standard input and prints the sum of all prime values.
`,
    points: 300,
    starterCodes: {
      c: `#include <stdio.h>
#include <stdbool.h>

bool isPrime(int n) {
    if (n <= 1) return false;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    int num, sum = 0;
    while (scanf("%d", &num) == 1) {
        if (isPrime(num)) {
            sum += num;
        }
    }
    printf("%d", sum);
    return 0;
}
`,
      cpp: `#include <iostream>

using namespace std;

bool isPrime(int n) {
    if (n <= 1) return false;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    int num, sum = 0;
    while (cin >> num) {
        if (isPrime(num)) sum += num;
    }
    cout << sum;
    return 0;
}
`,
      java: `import java.util.Scanner;

public class Main {
    private static boolean isPrime(int n) {
        if (n <= 1) return false;
        for (int i = 2; i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int sum = 0;
        while (scanner.hasNextInt()) {
            int num = scanner.nextInt();
            if (isPrime(num)) sum += num;
        }
        System.out.print(sum);
    }
}
`,
      javascript: `function solve(input) {
  function isPrime(num) {
    if (num <= 1) return false;
    for (let i = 2; i * i <= num; i++) {
      if (num % i === 0) return false;
    }
    return true;
  }
  const nums = input.trim().split(/\\s+/).map(Number);
  const sum = nums.filter(isPrime).reduce((a, b) => a + b, 0);
  return String(sum);
}
`,
      python: `def solve(input_str: str) -> str:
    def is_prime(n):
        if n <= 1: return False
        for i in range(2, int(n**0.5) + 1):
            if n % i == 0: return False
        return True
    nums = [int(x) for x in input_str.split()]
    return str(sum(x for x in nums if is_prime(x)))
`
    },
    testCases: [
      { input: "2 3 4 5", expected: "10", isHidden: false },
      { input: "10 11 12 13", expected: "24", isHidden: false },
      { input: "1 4 6 8", expected: "0", isHidden: true }
    ]
  })

  // 5. Configure Round 3: Clash of the Captains
  // 1 question, 15 minutes (900s), 2 compile attempts
  let round3 = await prisma.round.findFirst({
    where: { competitionId: competition.id, order: 3 }
  })

  if (!round3) {
    round3 = await prisma.round.create({
      data: {
        competitionId: competition.id,
        name: "Clash of the Captains",
        order: 3,
        durationSeconds: 15 * 60, // 15 minutes
        maxCompileAttempts: 2,
        status: "PENDING"
      }
    })
  } else {
    await prisma.round.update({
      where: { id: round3.id },
      data: {
        name: "Clash of the Captains",
        durationSeconds: 15 * 60,
        maxCompileAttempts: 2,
        status: "PENDING"
      }
    })
  }

  // Round 3 - Question 1
  await createOrUpdateQuestion(round3.id, {
    title: "The Final Flagship Duel: Cannonball Trajectory",
    description: `###  The Ultimate Showdown
Two colossal pirate flagships exchange broadside cannon fire.
Given an array of incoming cannonball trajectories with their velocities, find the maximum continuous subarray sum of impact forces using Kadane's algorithm.
Write a C program that reads a space-separated sequence of integers (which can include negative values) and prints the maximum continuous subarray sum.
`,
    points: 500,
    starterCodes: {
      c: `#include <stdio.h>

int main() {
    int num;
    if (scanf("%d", &num) == 1) {
        int maxSoFar = num;
        int currMax = num;
        while (scanf("%d", &num) == 1) {
            currMax = (num > currMax + num) ? num : currMax + num;
            if (currMax > maxSoFar) maxSoFar = currMax;
        }
        printf("%d", maxSoFar);
    } else {
        printf("0");
    }
    return 0;
}
`,
      cpp: `#include <iostream>
#include <algorithm>

using namespace std;

int main() {
    int num;
    if (cin >> num) {
        int maxSoFar = num;
        int currMax = num;
        while (cin >> num) {
            currMax = max(num, currMax + num);
            maxSoFar = max(maxSoFar, currMax);
        }
        cout << maxSoFar;
    } else {
        cout << 0;
    }
    return 0;
}
`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int num = scanner.nextInt();
            int maxSoFar = num;
            int currMax = num;
            while (scanner.hasNextInt()) {
                num = scanner.nextInt();
                currMax = Math.max(num, currMax + num);
                maxSoFar = Math.max(maxSoFar, currMax);
            }
            System.out.print(maxSoFar);
        } else {
            System.out.print(0);
        }
    }
}
`,
      javascript: `function solve(input) {
  const nums = input.trim().split(/\\s+/).map(Number);
  if (nums.length === 0) return "0";
  let maxSoFar = nums[0];
  let currMax = nums[0];
  for (let i = 1; i < nums.length; i++) {
    currMax = Math.max(nums[i], currMax + nums[i]);
    maxSoFar = Math.max(maxSoFar, currMax);
  }
  return String(maxSoFar);
}
`,
      python: `def solve(input_str: str) -> str:
    nums = [int(x) for x in input_str.split()]
    if not nums: return "0"
    max_so_far = curr_max = nums[0]
    for x in nums[1:]:
        curr_max = max(x, curr_max + x)
        max_so_far = max(max_so_far, curr_max)
    return str(max_so_far)
`
    },
    testCases: [
      { input: "-2 1 -3 4 -1 2 1 -5 4", expected: "6", isHidden: false },
      { input: "1 2 3 4 5", expected: "15", isHidden: false },
      { input: "-1 -2 -3", expected: "-1", isHidden: true }
    ]
  })

  console.log(" Pirate Championship successfully seeded with all 3 rounds and questions!")
  return competition
}

async function createOrUpdateQuestion(
  roundId: string,
  data: {
    title: string
    description: string
    points: number
    starterCodes: Record<string, string>
    testCases: Array<{ input: string; expected: string; isHidden: boolean }>
  }
) {
  let q = await prisma.question.findFirst({
    where: { roundId, title: data.title }
  })

  if (!q) {
    q = await prisma.question.create({
      data: {
        roundId,
        title: data.title,
        description: data.description,
        points: data.points
      }
    })
  } else {
    await prisma.question.update({
      where: { id: q.id },
      data: {
        description: data.description,
        points: data.points
      }
    })
  }

  await prisma.starterCode.deleteMany({ where: { questionId: q.id } })
  await prisma.starterCode.create({
    data: {
      questionId: q.id,
      language: CODE_LANGUAGE,
      code: data.starterCodes[CODE_LANGUAGE] || C_STARTER_CODE
    }
  })

  // Test cases
  // Clear old and insert new
  await prisma.testCase.deleteMany({ where: { questionId: q.id } })
  for (const tc of data.testCases) {
    await prisma.testCase.create({
      data: {
        questionId: q.id,
        input: tc.input,
        expected: tc.expected,
        isHidden: tc.isHidden
      }
    })
  }
}
