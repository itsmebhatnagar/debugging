import { auth } from "@/auth"
import { LandingView } from "@/components/LandingView"

export default async function HomePage() {
  const session = await auth()

  return <LandingView session={session} />
}
