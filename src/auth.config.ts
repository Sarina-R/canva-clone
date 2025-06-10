import { z } from "zod";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import { eq } from "drizzle-orm";
import { JWT } from "next-auth/jwt";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { db } from "@/db/drizzle";
import { users } from "@/db/schema";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
  }
}

type SessionData = {
  id?: string;
  email?: string;
  isLoggedIn: boolean;
};

const sessionOptions = {
  password: process.env.NEXTAUTH_SECRET!,
  cookieName: "session",
};

export async function getIronSessionData() {
  return await getIronSession<SessionData>(cookies(), sessionOptions);
}

export default {
  adapter: DrizzleAdapter(db),
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_ID,
      clientSecret: process.env.KEYCLOAK_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }, // Fixed typo
      },
      async authorize(credentials) {
        const validatedFields = CredentialsSchema.safeParse(credentials);
        if (!validatedFields.success) {
          return null;
        }

        const { email, password } = validatedFields.data;
        const query = await db
          .select()
          .from(users)
          .where(eq(users.email, email));
        const user = query[0];

        if (!user || !user.password) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) {
          return null;
        }

        return user;
      },
    }),
    GitHub,
    Google,
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? undefined;
        const ironSession = await getIronSessionData();
        ironSession.id = user.id ?? undefined;
        ironSession.email = user.email ?? "";
        ironSession.isLoggedIn = true;
        await ironSession.save();
      }
      return token;
    },
  },
  debug: process.env.NODE_ENV === "development", // Enable debug mode for development
} satisfies NextAuthConfig;
