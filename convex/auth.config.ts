/**
 * Convex <-> Clerk integration.
 * Clerk issues a JWT with the "convex" template; Convex validates it against
 * the Clerk issuer domain. Set CLERK_JWT_ISSUER_DOMAIN in the Convex
 * deployment environment (see .env.example / README).
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
