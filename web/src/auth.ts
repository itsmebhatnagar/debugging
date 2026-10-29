import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isAdminEmail } from "@/lib/admin-access"

const ADMIN_AUTH_STATE_ID = "singleton"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      id: "firebase",
      name: "Firebase",
      credentials: {
        idToken: { label: "ID Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null
        
        try {
          // Verify Firebase ID token securely using Firebase Identity Toolkit REST API
          const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
          const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: credentials.idToken })
          })
          
          if (!verifyRes.ok) return null
          
          const data = await verifyRes.json()
          const firebaseUser = data.users?.[0]
          
          if (!firebaseUser || !firebaseUser.email) return null
          
          let user = await prisma.user.findUnique({
            where: { email: firebaseUser.email }
          })
          
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: firebaseUser.email,
                name: firebaseUser.displayName || "Pirate",
                image: firebaseUser.photoUrl || null,
                emailVerified: firebaseUser.emailVerified ? new Date() : null,
                role: "USER"
              }
            })
          }
          
          return user
        } catch (error) {
          console.error("Firebase token verification failed:", error)
          return null
        }
      }
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const identifier = (credentials.email as string).trim().toLowerCase()
        console.log("[Auth.ts] authorize called with identifier:", identifier)
        
        const user = await prisma.user.findUnique({
          where: { email: identifier }
        })
        console.log("[Auth.ts] user found in DB:", !!user, "hasPassword:", !!user?.password)
        
        if (!user || !user.password) return null

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        console.log("[Auth.ts] passwordsMatch:", passwordsMatch)

        if (passwordsMatch) {
          // Return user object including role and mobile
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            mobile: user.mobile,
            role: user.role
          }
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as typeof user & {
          mobile?: string | null
          role?: string
        }
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.mobile = authenticatedUser.mobile
        const isAdmin = authenticatedUser.role === "ADMIN" || isAdminEmail(user.email)
        token.role = isAdmin ? "ADMIN" : "USER"
      } else {
        const isAdmin = token.role === "ADMIN" || isAdminEmail(token.email as string)
        token.role = isAdmin ? "ADMIN" : "USER"
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        if (token.id) session.user.id = token.id as string
        if (token.email) session.user.email = token.email as string
        if (token.name) session.user.name = token.name as string
        const isAdmin = token.role === "ADMIN" || isAdminEmail(token.email as string) || isAdminEmail(session.user.email)
        session.user.role = isAdmin ? "ADMIN" : "USER"
        session.user.mobile = (token.mobile as string) ?? null
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  }
})
