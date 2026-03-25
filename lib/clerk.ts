import { auth, currentUser } from "@clerk/nextjs/server"

export async function getUser() {
  const { userId } = await auth()

  if (!userId) {
    return null
  }

  return userId
}

export async function getCurrentUser() {
  return await currentUser()
}
