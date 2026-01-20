import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username },
              { email: credentials.username },
            ],
          },
        });

        if (!user) {
          console.log('User not found for:', credentials.username);
          throw new Error("User not found");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          console.log('Invalid password for user:', user.username);
          throw new Error("Invalid password");
        }

        console.log('Login successful for:', user.username);
        return {
          id: user.id.toString(),
          username: user.username,
          email: user.email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user && token.id) {
        try {
          // Fetch the latest user data from the database
          const dbUser = await prisma.user.findUnique({
            where: { id: parseInt(token.id as string) },
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              nickname: true,
            },
          });

          if (dbUser) {
            session.user.id = dbUser.id.toString();
            session.user.username = dbUser.username;
            session.user.email = dbUser.email;
            (session.user as any).avatar = dbUser.avatar;
            (session.user as any).nickname = dbUser.nickname;
          }
        } catch (error) {
          // If DB query fails, fallback to token data to avoid session loss
          console.error('Session callback error:', error);
          session.user.id = token.id;
          session.user.username = token.username;
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_URL?.startsWith('https://')
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: process.env.NEXTAUTH_URL?.startsWith('https://') ? 'none' : 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://'),
      },
    },
  },
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith('https://'),
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
