export interface UserDetails {
  name: string;
  email: string;
  mobile: string;
  username: string;
  college: string;
  userId: string;
}

/**
 * Normalizes a phone number for comparison by stripping formatting characters
 * and retaining the significant national digits (last 10 digits).
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return "";
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Extracts normalized user details from any participant or leaderboard object.
 */
export function extractDetails(entry: any): UserDetails {
  if (!entry) {
    return { name: "", email: "", mobile: "", username: "", college: "", userId: "" };
  }

  const rawName =
    entry.name ||
    entry.user?.name ||
    entry.participant?.name ||
    entry.username ||
    entry.participant?.username ||
    (entry.user?.email ? entry.user.email.split("@")[0] : "") ||
    (entry.email ? entry.email.split("@")[0] : "") ||
    "";

  const rawEmail =
    entry.email ||
    entry.user?.email ||
    entry.participant?.email ||
    "";

  const rawMobile =
    entry.mobile ||
    entry.phone ||
    entry.user?.mobile ||
    entry.user?.phone ||
    entry.participant?.mobile ||
    entry.participant?.phone ||
    "";

  const rawUsername =
    entry.username ||
    entry.user?.username ||
    entry.participant?.username ||
    "";

  const rawCollege =
    entry.college ||
    entry.user?.college ||
    entry.participant?.college ||
    "";

  const rawUserId =
    entry.userId ||
    entry.user?.id ||
    entry.participant?.id ||
    entry.participant?.userId ||
    "";

  return {
    name: String(rawName).trim(),
    email: String(rawEmail).trim().toLowerCase(),
    mobile: String(rawMobile).trim(),
    username: String(rawUsername).trim().toLowerCase(),
    college: String(rawCollege).trim().toLowerCase(),
    userId: String(rawUserId).trim(),
  };
}

/**
 * Checks if the details of two users with the same name are considered the SAME or DIFFERENT.
 * 
 * Rules:
 * - If identifying fields (email, mobile/phone, username, college) CONFLICT, details are NOT the same (different people).
 * - If identifying fields MATCH, or both have identical/blank details, details ARE the same (same person duplicate).
 */
export function areDetailsIdentical(aDetails: UserDetails, bDetails: UserDetails): boolean {
  // If both have the same non-empty userId, it is definitely the same user
  if (aDetails.userId && bDetails.userId && aDetails.userId === bDetails.userId) {
    return true;
  }

  // 1. Email comparison: if both provided and different -> different users
  if (aDetails.email && bDetails.email && aDetails.email !== bDetails.email) {
    return false;
  }

  // 2. Mobile/phone comparison: normalize and compare
  const phoneA = normalizePhone(aDetails.mobile);
  const phoneB = normalizePhone(bDetails.mobile);
  if (phoneA && phoneB && phoneA !== phoneB) {
    return false;
  }

  // 3. Username comparison: if both provided and different -> different users
  if (aDetails.username && bDetails.username && aDetails.username !== bDetails.username) {
    return false;
  }

  // 4. College comparison: if both provided and different -> different users
  if (aDetails.college && bDetails.college && aDetails.college !== bDetails.college) {
    return false;
  }

  // Check if at least one shared identifier matched positively
  const hasMatchingIdentifier =
    (Boolean(aDetails.email) && Boolean(bDetails.email) && aDetails.email === bDetails.email) ||
    (Boolean(phoneA) && Boolean(phoneB) && phoneA === phoneB) ||
    (Boolean(aDetails.username) && Boolean(bDetails.username) && aDetails.username === bDetails.username) ||
    (Boolean(aDetails.userId) && Boolean(bDetails.userId) && aDetails.userId === bDetails.userId);

  if (hasMatchingIdentifier) {
    return true;
  }

  // Check if both records have NO details at all (only name provided)
  const aHasAnyDetail = Boolean(aDetails.email || phoneA || aDetails.username || aDetails.college);
  const bHasAnyDetail = Boolean(bDetails.email || phoneB || bDetails.username || bDetails.college);

  if (!aHasAnyDetail && !bHasAnyDetail) {
    // Both have only the name and no distinguishing details -> treat as duplicate
    return true;
  }

  // If one has email/phone and the other has nothing, but same name:
  // If no details conflict and neither has a conflicting field, treat as same person
  if ((aDetails.email && !bHasAnyDetail) || (bDetails.email && !aHasAnyDetail)) {
    return true;
  }

  // Otherwise keep both to avoid false positives
  return false;
}

/**
 * Deduplicates leaderboard and participant lists according to the rule:
 * - If name is unique: keep.
 * - If 2 or more users share the same name: check their details.
 *   - If details are ALSO the same: discard one of them (keep the best one).
 *   - If details are NOT the same: keep both.
 */
export function deduplicateByUserDetails<T>(
  items: T[],
  options?: {
    getScore?: (item: T) => number;
  }
): T[] {
  if (!Array.isArray(items) || items.length <= 1) {
    return items || [];
  }

  const result: T[] = [];

  for (const item of items) {
    const details = extractDetails(item);
    const normalizedName = details.name.toLowerCase();

    // If item has no name at all, check if already in result by id/email
    if (!normalizedName) {
      result.push(item);
      continue;
    }

    // Check if an existing entry has the same name AND same details
    const existingIndex = result.findIndex((existing) => {
      const existingDetails = extractDetails(existing);
      if (existingDetails.name.toLowerCase() !== normalizedName) {
        return false;
      }
      return areDetailsIdentical(existingDetails, details);
    });

    if (existingIndex === -1) {
      // Either name is unique, or name is shared but details are different -> KEEP
      result.push(item);
    } else {
      // Name is same AND details are same -> DISCARD one of them
      // Keep the one with higher score or better priority
      const existingItem = result[existingIndex];
      const existingScore = options?.getScore
        ? options.getScore(existingItem)
        : (existingItem as any)?.totalScore ?? (existingItem as any)?.score ?? 0;
      const currentScore = options?.getScore
        ? options.getScore(item)
        : (item as any)?.totalScore ?? (item as any)?.score ?? 0;

      if (currentScore > existingScore) {
        result[existingIndex] = item;
      }
    }
  }

  return result;
}
