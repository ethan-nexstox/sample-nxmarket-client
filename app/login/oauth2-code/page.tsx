"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function OAuth2CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<string>("Processing...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code")
      const state = searchParams.get("state")
      const errorParam = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      // Handle OAuth2 error responses
      if (errorParam) {
        setError(`OAuth2 Error: ${errorParam} - ${errorDescription || ""}`)
        return
      }

      // Validate required parameters
      if (!code || !state) {
        setError("Invalid callback: Missing code or state parameter")
        return
      }

      try {
        // Retrieve stored values from sessionStorage
        const storedState = sessionStorage.getItem("oauth_state")
        const codeVerifier = sessionStorage.getItem("pkce_code_verifier")
        const nonce = sessionStorage.getItem("oauth_nonce")

        // Validate state parameter (CSRF protection)
        if (state !== storedState) {
          setError("Invalid state parameter - possible CSRF attack")
          return
        }

        if (!codeVerifier) {
          setError("Missing code_verifier - session may have expired")
          return
        }

        setStatus("Exchanging authorization code for tokens...")

        // Exchange authorization code for tokens
        const tokenResponse = await exchangeCodeForTokens(code, codeVerifier)

        if (!tokenResponse.success) {
          setError(`Token exchange failed: ${tokenResponse.error}`)
          return
        }

        setStatus("Validating ID token...")

        // Validate nonce in ID token if present
        if (tokenResponse.id_token && nonce) {
          const isValid = await validateIdToken(tokenResponse.id_token, nonce)
          if (!isValid) {
            setError("ID token validation failed - invalid nonce")
            return
          }
        }

        setStatus("Authentication successful! Redirecting...")

        // Store tokens in localStorage (or you could use cookies)
        localStorage.setItem("access_token", tokenResponse.access_token)
        if (tokenResponse.refresh_token) {
          localStorage.setItem("refresh_token", tokenResponse.refresh_token)
        }
        if (tokenResponse.id_token) {
          localStorage.setItem("id_token", tokenResponse.id_token)
        }

        // Clear session storage
        sessionStorage.removeItem("oauth_state")
        sessionStorage.removeItem("pkce_code_verifier")
        sessionStorage.removeItem("oauth_nonce")

        // Redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard")
        }, 1000)
      } catch (err) {
        setError(`Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">OAuth2 Callback</h1>
        {error ? (
          <div className="w-full rounded border border-red-500 bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600"></div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
          </div>
        )}
      </main>
    </div>
  )
}

interface TokenResponse {
  success: boolean
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  error?: string
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const tokenEndpoint = process.env.NEXT_PUBLIC_OAUTH2_TOKEN_ENDPOINT!
  const clientId = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID!
  const clientSecret = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_SECRET!
  const redirectUri = process.env.NEXT_PUBLIC_OAUTH2_REDIRECT_URI!

  try {
    const tokenParams = new URLSearchParams()
    tokenParams.set("grant_type", "authorization_code")
    tokenParams.set("code", code)
    tokenParams.set("redirect_uri", redirectUri)
    tokenParams.set("client_id", clientId)
    tokenParams.set("code_verifier", codeVerifier)

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
      return {
        success: false,
        access_token: "",
        token_type: "",
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      id_token: data.id_token,
    }
  } catch (error) {
    return {
      success: false,
      access_token: "",
      token_type: "",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function validateIdToken(idToken: string, expectedNonce: string): Promise<boolean> {
  try {
    // Parse JWT (without verification for now - in production, verify signature!)
    const parts = idToken.split(".")
    if (parts.length !== 3) {
      return false
    }

    const payload = JSON.parse(atob(parts[1]))
    
    // Validate nonce
    if (payload.nonce !== expectedNonce) {
      console.error("Nonce mismatch:", { expected: expectedNonce, actual: payload.nonce })
      return false
    }

    // Additional validations could include:
    // - Verify signature with public key
    // - Check expiration (exp)
    // - Check issued at (iat)
    // - Check issuer (iss)
    // - Check audience (aud)

    return true
  } catch (error) {
    console.error("ID token validation error:", error)
    return false
  }
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">OAuth2 Callback</h1>
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600"></div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </main>
    </div>
  )
}

// Wrap the component that uses useSearchParams in Suspense
export default function OAuth2Callback() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OAuth2CallbackContent />
    </Suspense>
  )
}

