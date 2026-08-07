"use client";

import { getSession, signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  // NextAuth tự làm mới access token trong callback jwt() (xem route.ts),
  // nên ở đây chỉ cần đọc session hiện tại.
  const session = await getSession();

  // Nếu quá trình refresh phía server thất bại → đăng xuất
  if (session?.error === "RefreshAccessTokenError") {
    signOut({ callbackUrl: "/login" });
    throw new Error("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const accessToken = session?.accessToken;

  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Xử lý lỗi 401 Unauthorized
  if (response.status === 401) {
    signOut({ callbackUrl: "/login" });
    throw new Error("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.detail || "Yêu cầu API thất bại");
  }

  return response.json();
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint),
  
  post: <T extends Record<string, unknown>>(endpoint: string, data: T) =>
    fetchWithAuth(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  
  put: <T extends Record<string, unknown>>(endpoint: string, data: T) =>
    fetchWithAuth(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  
  patch: <T extends Record<string, unknown>>(endpoint: string, data: T) =>
    fetchWithAuth(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  
  delete: (endpoint: string) =>
    fetchWithAuth(endpoint, {
      method: "DELETE",
    }),
}; 