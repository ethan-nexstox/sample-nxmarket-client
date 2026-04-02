"use client"

import { useState } from "react"

interface RefreshTokenButtonProps {
  onTokenRefreshed?: (newAccessToken: string) => void
  onRefreshTokenUpdate?: (newRefreshToken: string) => void
  refreshToken: string
}

export function RefreshTokenButton({ onTokenRefreshed, refreshToken, onRefreshTokenUpdate }: RefreshTokenButtonProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null)

  const handleRefreshToken = async () => {
    setRefreshing(true)
    setRefreshError(null)
    setRefreshSuccess(null)

    try {
      if (!refreshToken) {
        throw new Error("No refresh token available. Please log in again.")
      }

      const tokenEndpoint = process.env.NEXT_PUBLIC_OAUTH2_TOKEN_ENDPOINT
      const clientId = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID
      const clientSecret = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_SECRET

      if (!tokenEndpoint || !clientId) {
        throw new Error("OAuth2 configuration is missing")
      }

      const tokenParams = new URLSearchParams()
      tokenParams.set("grant_type", "refresh_token")
      tokenParams.set("refresh_token", refreshToken)
      tokenParams.set("client_id", clientId)

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",

          // Basic Authentication type for this client
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: tokenParams.toString(),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error_description || errorData.error || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      const data = await response.json()

      // Update tokens in localStorage
      localStorage.setItem("access_token", data.access_token)
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token)
      }
      if (data.id_token) {
        localStorage.setItem("id_token", data.id_token)
      }

      setRefreshSuccess("Access token refreshed successfully!")

      // Notify parent component
      if (typeof onTokenRefreshed == 'function') {
        onTokenRefreshed(data.access_token)
      }

      if (typeof onRefreshTokenUpdate == 'function') {
        onRefreshTokenUpdate(data.refresh_token)
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setRefreshSuccess(null)
      }, 3000)
    } catch (error) {
      console.error("Token refresh error:", error)
      setRefreshError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <button
        onClick={handleRefreshToken}
        disabled={refreshing}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {refreshing ? "Refreshing..." : "Refresh Token"}
      </button>

      {refreshSuccess && (
        <div className="absolute right-8 top-20 z-10 rounded border border-green-500 bg-green-50 p-4 text-green-700 shadow-lg dark:bg-green-950 dark:text-green-300">
          <p className="font-semibold">✓ {refreshSuccess}</p>
        </div>
      )}

      {refreshError && (
        <div className="absolute right-8 top-20 z-10 rounded border border-red-500 bg-red-50 p-4 text-red-700 shadow-lg dark:bg-red-950 dark:text-red-300">
          <p className="font-semibold">Error:</p>
          <p className="text-sm">{refreshError}</p>
        </div>
      )}
    </>
  )
}
