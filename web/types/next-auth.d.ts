import NextAuth, { type DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession["user"] & {
  role: "ADMIN" | "USER"
  mobile: string | null
}

declare module "next-auth" {
  interface Session {
    user: ExtendedUser
  }
  
  interface User {
    role: "ADMIN" | "USER"
    mobile?: string | null
  }
}

import { JWT } from "next-auth/jwt"

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: "ADMIN" | "USER"
    mobile?: string | null
  }
}
