import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";


export const authOptions: NextAuthOptions ={
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {

    async jwt({ token, account, profile }: { token: JWT; account: any; profile?: any }) {
        if (account && profile) {
            token.email   = profile.email;
            token.picture = (profile as any).picture;
        }
        return token;
    },

    async session({ session, token }: { session: any; token: JWT }) {
        session.user!.email   = token.email  as string;
        session.user!.image   = token.picture as string;
        return session;

    },
  },
};
export default NextAuth(authOptions);