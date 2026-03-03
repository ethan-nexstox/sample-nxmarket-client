import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
}

interface TokenErrorResponse {
  error: string
  error_description?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, code_verifier } = body

    if (!code || !code_verifier) {
      return NextResponse.json(
        { error: "Missing required parameters: code and code_verifier" },
        { status: 400 }
      )
    }

    // Server-side OAuth credentials (not exposed to client)
    const tokenEndpoint = process.env.OAUTH2_TOKEN_ENDPOINT
    const clientId = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID
    const clientSecret = process.env.OAUTH2_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_OAUTH2_REDIRECT_URI

    console.log("💁 tokenEndpoint:", tokenEndpoint)
    console.log("💁 clientId:", clientId)
    console.log("💁 clientSecret:", clientSecret)
    console.log("💁 redirectUri:", redirectUri)

    if (!tokenEndpoint || !clientId || !clientSecret || !redirectUri) {
      console.error("Missing OAuth2 configuration")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Exchange authorization code for tokens
    const tokenParams = new URLSearchParams()
    tokenParams.set("grant_type", "authorization_code")
    tokenParams.set("code", code)
    tokenParams.set("redirect_uri", redirectUri)
    tokenParams.set("code_verifier", code_verifier)

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",

        // Basic Authentication type for this client
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorData: TokenErrorResponse = await tokenResponse.json().catch(() => ({
        error: `HTTP ${tokenResponse.status}`,
      }))
      console.error("Token exchange failed:", errorData)
      return NextResponse.json(
        { error: errorData.error, error_description: errorData.error_description },
        { status: tokenResponse.status }
      )
    }

    const tokenData: TokenResponse = await tokenResponse.json()

    // Set refresh token as HTTP-only cookie
    if (tokenData.refresh_token) {
      const cookieStore = await cookies()
      cookieStore.set("refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        // Set a long expiration for refresh token (e.g., 30 days)
        maxAge: 30 * 24 * 60 * 60,
      })
    }

    // Return access token and id_token to client (but NOT refresh_token)
    return NextResponse.json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      id_token: tokenData.id_token,
    })
  } catch (error) {
    console.error("Token exchange error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
