import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { jwtDecode } from "jwt-decode";

// Login/refresh chạy SERVER-SIDE (trong container web) → gọi thẳng backend nội bộ.
// Prod (Coolify): đặt API_PROXY_TARGET=http://api:8000 → API_URL=http://api:8000/api/v1
// Dev: fallback NEXT_PUBLIC_API_URL (http://localhost:8000/api/v1).
const _target = process.env.API_PROXY_TARGET
  || (process.env.NODE_ENV === "production" ? "http://api:8000" : "");
const API_URL = _target
  ? `${_target}/api/v1`
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1");

interface JwtPayload {
  sub: string;
  userName: string;
  role: string;
  iat?: number;
  exp?: number;
}

// KHÔNG dùng fallback secret. Không throw ở top-level (sẽ vỡ `next build` khi
// thu thập metadata). NextAuth v4 tự báo lỗi ở runtime production nếu thiếu secret.
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// Mở rộng các kiểu session và JWT mặc định
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
    user: {
      name?: string | null;
      id?: string;
      role?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    userId?: string;
    role?: string;
    error?: string;
  }
}

// Lấy thời điểm hết hạn (ms) từ chính JWT access token
function getTokenExpiry(accessToken?: string): number | undefined {
  if (!accessToken) return undefined;
  try {
    const decoded = jwtDecode<JwtPayload>(accessToken);
    return decoded.exp ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

// Gọi backend để làm mới access token bằng refresh token
async function refreshAccessToken(
  token: import("next-auth/jwt").JWT,
): Promise<import("next-auth/jwt").JWT> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Refresh thất bại");
    }

    const data = await response.json();
    return {
      ...token,
      accessToken: data.access_token,
      // Backend xoay refresh token → luôn dùng cái mới nhất
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: getTokenExpiry(data.access_token),
      error: undefined,
    };
  } catch (error) {
    console.error("Lỗi khi làm mới token:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          
          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userName: credentials?.username,
              password: credentials?.password,
            }),
          });
          
          
          if (!response.ok) {
            const errorData = await response.text();
            console.error("Phản hồi lỗi xác thực:", errorData);
            return null;
          }

          const data = await response.json();
          
          // Giải mã JWT để lấy thông tin người dùng
          try {
            const decodedToken = jwtDecode<JwtPayload>(data.access_token);
            
            return {
              id: decodedToken.sub,
              name: decodedToken.userName,
              role: decodedToken.role,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
            };
          } catch (decodeError) {
            console.error("Lỗi giải mã JWT:", decodeError);
            // Dự phòng nếu việc giải mã token thất bại
            return {
              id: credentials?.username || "user-id",
              name: credentials?.username || "user",
              role: "user",
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
            };
          }
        } catch (error) {
          console.error("Lỗi xác thực:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Đăng nhập ban đầu
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = getTokenExpiry(user.accessToken);
        token.name = user.name;
        token.userId = user.id;
        token.role = user.role;
        return token;
      }

      // Token còn hạn (đệm 60s) → dùng lại
      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60_000
      ) {
        return token;
      }

      // Hết hạn → làm mới (ghi lại vào JWT/cookie, đúng chuẩn NextAuth)
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.error = token.error;
      session.user = {
        name: token.name,
        id: token.userId,
        role: token.role,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
  secret: NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST }; 