"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { LogoutButton } from "./components/LogoutButton"
import { OidcLogoutButton } from "./components/OidcLogoutButton"
import { RefreshTokenButton } from "./components/RefreshTokenButton"

interface UserInfo {
  sub?: string
  name?: string
  email?: string
  [key: string]: unknown
}

interface ProfileInfo {
  id?: string
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

// Here is the documentation of the resource server API to get full user info
// https://staging-admin.staging.nxmarket.com/docs/#tag/user-controller/operation/myProfile

export default function Dashboard() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Make an authenticated API request with automatic token refresh
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const makeRequest = async (access_token: string) => {
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        })
      }

      if (!accessToken) {
        throw new Error("No access token available")
      }

      const response = await makeRequest(accessToken)

      // If unauthorized, try to refresh the token
      if (response.status === 401) {
        // Refresh failed - redirect to login
        // router.push("/")
        console.error("Session expired -- why can't get refresh token?", response.status, response.statusText)
        throw new Error("Session expired")
      }

      return response
    },
    [accessToken]
  )

  useEffect(() => {
    // Check for access token
    const idToken = localStorage.getItem("id_token")
    const token = localStorage.getItem("access_token")

    if (!token) {
      router.push("/")
      return
    }

    setAccessToken(token)

    // Parse ID token to get user info
    if (idToken) {
      try {
        const parts = idToken.split(".")
        const payload = JSON.parse(atob(parts[1]))
        setUserInfo(payload)
      } catch (error) {
        console.error("Failed to parse ID token:", error)
      }
    }

    // Fetch full user profile from resource server
    const fetchProfile = async () => {
      setProfileLoading(true)
      setProfileError(null)

      try {
        const apiUrl = process.env.NEXT_PUBLIC_NXMARKET_API
        if (!apiUrl) {
          throw new Error("NEXT_PUBLIC_NXMARKET_API environment variable is not set")
        }

        const response = await fetchWithAuth(`${apiUrl}/api/v1/users/me`)

        if (!response.ok) {
          throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        setProfileInfo(data)
      } catch (error) {
        console.error("Error fetching profile:", error)
        setProfileError(error instanceof Error ? error.message : "Unknown error")
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
    setLoading(false)
  }, [fetchWithAuth, router])

  const handleTokenRefreshed = (newAccessToken: string) => {
    // Update access token state
    setAccessToken(newAccessToken)

    // Parse new ID token to update user info
    const newIdToken = localStorage.getItem("id_token")
    if (newIdToken) {
      try {
        const parts = newIdToken.split(".")
        const payload = JSON.parse(atob(parts[1]))
        setUserInfo(payload)
      } catch (error) {
        console.error("Failed to parse new ID token:", error)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <RefreshTokenButton onTokenRefreshed={handleTokenRefreshed} />
            <LogoutButton />
            <OidcLogoutButton />
          </div>
        </div>

        <div className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-semibold">Authentication Status</h2>
          <p className="text-green-600 dark:text-green-400">✓ Successfully authenticated</p>
        </div>

        {userInfo && (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-3 text-xl font-semibold">ID Token Claims</h2>
            <dl className="space-y-2">
              {userInfo.sub && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Subject (sub)</dt>
                  <dd className="text-sm">{userInfo.sub}</dd>
                </div>
              )}
              {userInfo.name && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Name</dt>
                  <dd className="text-sm">{userInfo.name}</dd>
                </div>
              )}
              {userInfo.email && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Email</dt>
                  <dd className="text-sm">{userInfo.email}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-semibold">Full Profile (from Resource Server)</h2>
          {profileLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
              Loading profile...
            </div>
          )}
          {profileError && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              Error: {profileError}
            </div>
          )}
          {profileInfo && !profileLoading && (
            <dl className="space-y-2">
              {profileInfo.id && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">User ID</dt>
                  <dd className="text-sm">{profileInfo.id}</dd>
                </div>
              )}
              {profileInfo.username && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Username</dt>
                  <dd className="text-sm">{profileInfo.username}</dd>
                </div>
              )}
              {profileInfo.email && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Email</dt>
                  <dd className="text-sm">{profileInfo.email}</dd>
                </div>
              )}
              {profileInfo.firstName && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">First Name</dt>
                  <dd className="text-sm">{profileInfo.firstName}</dd>
                </div>
              )}
              {profileInfo.lastName && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Last Name</dt>
                  <dd className="text-sm">{profileInfo.lastName}</dd>
                </div>
              )}
              {profileInfo.phoneNumber && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Phone Number</dt>
                  <dd className="text-sm">{profileInfo.phoneNumber}</dd>
                </div>
              )}
              {profileInfo.createdAt && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Account Created</dt>
                  <dd className="text-sm">{new Date(profileInfo.createdAt).toLocaleString()}</dd>
                </div>
              )}
              {profileInfo.updatedAt && (
                <div>
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Last Updated</dt>
                  <dd className="text-sm">{new Date(profileInfo.updatedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-semibold">Access Token</h2>
          <div className="overflow-x-auto">
            <code className="block break-all rounded bg-white p-3 text-xs dark:bg-zinc-900">{accessToken}</code>
          </div>
        </div>
      </main>
    </div>
  )
}
