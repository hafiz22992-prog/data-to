import type { AuthConfig } from "convex/server";

// Freebuff-signed federated tokens (see freebuff web's
// src/lib/vly-convex-jwt.ts) let a signed-in freebuff.com user carry their
// identity into this project without going through local sign-in. customJwt
// is correct for this provider: freebuff's tokens and JWKS both carry a
// `kid` header, which the customJwt validation path requires.
const freebuffIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://freebuff.com";

export default {
  providers: [
    // Convex self-issued JWTs for email/guest sign-in (see auth.ts).
    // Do NOT convert to customJwt — the self-issued tokens lack a `kid`
    // header which that path requires.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
    // Freebuff federated JWTs.
    {
      type: "customJwt",
      issuer: freebuffIssuer,
      jwks: `${freebuffIssuer}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
    // WorkOS AuthKit — validates JWTs issued by WorkOS.
    {
      type: "customJwt",
      issuer: "https://api.workos.com",
      jwks: "https://api.workos.com/.well-known/jwks.json",
      applicationID: "workos",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
