This is a [Next.js](https://nextjs.org) project implementing OAuth2 authentication with PKCE (Proof Key for Code Exchange).

## Features

- **OAuth2 with PKCE**: Secure authentication flow using PKCE for public clients
- **Dynamic Parameter Generation**: Automatically generates `code_verifier`, `code_challenge`, `state`, and `nonce`
- **Security Validations**: State parameter validation (CSRF protection) and nonce validation (replay attack prevention)
- **Token Management**: Secure token storage in localStorage
- **User Dashboard**: Displays authenticated user information and access token

## Getting Started

1. Edit `.env.local` with your OAuth2 server configuration if needed.

```sh
tee .env.local<<EOL
OAUTH2_CLIENT_SECRET=P9fMuNLHz9XtJs43gjMyNaguXrbchXEwQZxptu4Zi
EOL
```

2. Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3074](http://localhost:3074) with your browser to see the result.

## OAuth2 Flow

### 1. Login Page (`/`)
- Generates PKCE parameters (`code_verifier`, `code_challenge`)
- Generates security parameters (`state`, `nonce`)
- Stores parameters in `sessionStorage`
- Redirects to OAuth2 authorization server

### 2. OAuth2 Callback (`/login/oauth2-code`)
- Validates `state` parameter against stored value (CSRF protection)
- Exchanges authorization code for access token using `code_verifier`
- Validates `nonce` in ID token
- Stores tokens in `localStorage`
- Redirects to dashboard

### 3. Dashboard (`/dashboard`)
- Displays authenticated user information from ID token
- Shows access token
- Provides logout functionality

## Configuration

Configuration is managed through environment variables in `.env.local`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_OAUTH2_AUTHORIZATION_URL` | OAuth2 authorization endpoint | `http://localhost:3072` |
| `NEXT_PUBLIC_OAUTH2_TOKEN_ENDPOINT` | OAuth2 token endpoint | `http://localhost:3072/oauth2/token` |
| `NEXT_PUBLIC_OAUTH2_CLIENT_ID` | OAuth2 client ID | `nxmarket-client-web` |
| `NEXT_PUBLIC_OAUTH2_REDIRECT_URI` | OAuth2 redirect URI | `http://localhost:3074/login/oauth2-code` |
| `NEXT_PUBLIC_OAUTH2_SCOPE` | OAuth2 scopes | `openid profile api.exchange api.user` |

See `.env.example` for a complete example configuration.

## Security Features

- **PKCE (RFC 7636)**: Prevents authorization code interception attacks
- **State Parameter**: CSRF protection
- **Nonce Parameter**: Replay attack prevention
- **Secure Storage**: Tokens stored in localStorage (consider httpOnly cookies for production)

## Project Structure

```
app/
├── page.tsx                    # Login page with OAuth2 initiation
├── dashboard/
│   └── page.tsx               # Protected dashboard page
└── login/oauth2-code/
    └── page.tsx               # OAuth2 callback handler
```

# Logout

## Logout locally (no OIDC)

## ✅ High-Level Concept: Client-Initiated Logout in OAuth2/OIDC
### 1. The client cannot “log out” of the Authorization Server directly.

- OAuth2 itself does not define logout.
- Logout is part of OIDC (OpenID Connect) via:
- RP-Initiated Logout (front-channel logout)
- Back-channel logout

Spring Authorization Server currently implements OIDC Logout Endpoints (depending on version).

### 2. Logout has two parts
#### (A) LOGOUT FROM THE CLIENT APP (Local logout)

The client:

1. Deletes local session/cookies
2. Deletes stored tokens
3. Redirects user to the Authorization Server’s logout page

Example (client handles UI/session logout):

```java
SecurityContextLogoutHandler handler = new SecurityContextLogoutHandler();
handler.logout(request, response, auth);
```

Then redirect to AS:
```
/connect/logout?id_token_hint={id_token}&post_logout_redirect_uri={uri}
```

### (B) LOGOUT FROM THE AUTHORIZATION SERVER (Global logout)

After redirect, the Authorization Server will:

1. Kill the AS session
2. Kill SSO cookies
3. Optionally revoke tokens
4. Redirect back to the client (post_logout_redirect_uri)

### 3. ⚙️ What the client must store

To do logout properly, the client needs the user’s ID Token (from login response).
It uses it as the id_token_hint parameter when redirecting to the Authorization Server logout endpoint.

