import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';

function sanitizeSessionImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const image = value.trim();
  if (!image) return undefined;
  if (image.length > 1024) return undefined;
  if (image.startsWith('data:')) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
    return image;
  }
  return undefined;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? '';

        if (!email || !password) return null;

        const user = await db.getUserByEmailWithPassword(email);
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: sanitizeSessionImage(user.profileImageUrl),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        const nextImage = sanitizeSessionImage((user as any).image);
        token.picture = nextImage ?? undefined;
      }

      if (trigger === 'update' && session) {
        if (typeof session.name === 'string') token.name = session.name;
        if (typeof session.email === 'string') token.email = session.email;
        if (typeof session.image === 'string' || session.image === null) {
          token.picture = sanitizeSessionImage(session.image) ?? undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (typeof token.name === 'string') session.user.name = token.name;
        if (typeof token.email === 'string') session.user.email = token.email;
        const sessionImage = sanitizeSessionImage(token.picture);
        if (sessionImage) {
          session.user.image = sessionImage;
        } else {
          session.user.image = undefined;
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const normalizedAppUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || baseUrl).replace(/\/+$/, '');
      const appOrigin = new URL(normalizedAppUrl).origin;
      const baseOrigin = new URL(baseUrl).origin;

      if (url.startsWith('/')) {
        return `${normalizedAppUrl}${url}`;
      }

      try {
        const target = new URL(url);
        if (target.origin === appOrigin || target.origin === baseOrigin) {
          return url;
        }
      } catch {
        // Fall back below when URL parsing fails.
      }

      return normalizedAppUrl;
    },
  },
  pages: {
    signIn: '/login',
  },
};

export async function getAuthUser() {
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
