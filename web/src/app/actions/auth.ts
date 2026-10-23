"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const loginLimiter = new Map<string, { count: number; expiresAt: number }>()

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  if (!email) return "Email is required."

  // Rate Limiting
  const now = Date.now()
  const limitWindow = 15 * 60 * 1000 // 15 minutes
  const maxAttempts = 5

  let limitRecord = loginLimiter.get(email)
  if (limitRecord) {
    if (now > limitRecord.expiresAt) {
      // Expired, reset
      limitRecord = { count: 0, expiresAt: now + limitWindow }
    } else if (limitRecord.count >= maxAttempts) {
      return "Too many login attempts. Try again later."
    }
  } else {
    limitRecord = { count: 0, expiresAt: now + limitWindow }
  }

  limitRecord.count += 1
  loginLimiter.set(email, limitRecord)

  try {
    await signIn("credentials", formData)
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid email or password."
        default:
          return "Something went wrong."
      }
    }
    throw error
  }
}

export async function registerUser(
  prevState: string | undefined,
  formData: FormData,
) {
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const password = formData.get("password") as string
  const name = (formData.get("name") as string)?.trim()
  const mobile = (formData.get("mobile") as string)?.trim()

  if (!email || !password || !name || !mobile) {
    return "All fields (Name, Email, Mobile, Password) are required."
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters long."
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return "An account with this email already exists."

  const hashedPassword = await bcrypt.hash(password, 10)

  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      mobile,
      role: "USER",
    },
  })

  // Automatically enroll new users into all existing competitions
  const competitions = await prisma.competition.findMany({ select: { id: true } })
  for (const comp of competitions) {
    await prisma.competitionParticipant.upsert({
      where: {
        competitionId_userId: {
          competitionId: comp.id,
          userId: newUser.id,
        }
      },
      update: {},
      create: {
        competitionId: comp.id,
        userId: newUser.id,
        score: 0
      }
    })
  }

  return "SUCCESS"
}
