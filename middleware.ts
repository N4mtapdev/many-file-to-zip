import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    error: "/auth-error",
  },
});

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /api/auth/* (NextAuth's own sign-in/callback routes)
     * - /auth-error (shown when a non-allowed account tries to sign in)
     * - static assets
     */
    "/((?!api/auth|auth-error|_next/static|_next/image|favicon.ico).*)",
  ],
};
