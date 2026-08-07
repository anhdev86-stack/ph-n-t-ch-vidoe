import { api } from "../lib/api";
import { CreateAccountDto, TikTokAccount, UpdateAccountDto, UpdateTaskDto, Task, VideoAnalyticsResponse, AffiliateOrdersApiResponse, VideoProductsApiResponse } from "../types/tikTokTypes";

const BASE_URL = "/accounts";

export const tikTokAccountService = {
  // Get all accounts
  getAllAccounts: async (): Promise<TikTokAccount[]> => {
    return api.get(BASE_URL);
  },

  // Get account by ID
  getAccountById: async (id: string): Promise<TikTokAccount> => {
    return api.get(`${BASE_URL}/${id}`);
  },

  // Create new account
  createAccount: async (data: CreateAccountDto): Promise<TikTokAccount> => {
    return api.post(BASE_URL, data as unknown as Record<string, unknown>);
  },

  // Update account
  updateAccount: async (id: string, data: UpdateAccountDto): Promise<TikTokAccount> => {
    return api.patch(`${BASE_URL}/${id}`, data as unknown as Record<string, unknown>);
  },

  // Delete account
  deleteAccount: async (id: string): Promise<TikTokAccount> => {
    return api.delete(`${BASE_URL}/${id}`);
  },

  // Toggle account status
  toggleAccountStatus: async (id: string, status: boolean): Promise<TikTokAccount> => {
    return api.patch(`${BASE_URL}/${id}`, { status } as Record<string, unknown>);
  },

  // Get account task
  getAccountTask: async (id: string): Promise<Task> => {
    return api.get(`${BASE_URL}/${id}/task`);
  },

  // Update account task
  updateAccountTask: async (id: string, data: UpdateTaskDto): Promise<TikTokAccount> => {
    return api.patch(`${BASE_URL}/${id}/task`, data as unknown as Record<string, unknown>);
  },

  // Run account task manually
  runAccountTask: async (id: string, isAllMonth: boolean): Promise<TikTokAccount> => {
    return api.patch(`${BASE_URL}/${id}/task/run`, {isAllMonth} as unknown as Record<string, unknown>);
  },

  // Run account task for specific month
  runAccountTaskSpecificMonth: async (id: string, year: number, month: number): Promise<TikTokAccount> => {
    return api.patch(`${BASE_URL}/${id}/task/run-specific-month`, {year, month} as unknown as Record<string, unknown>);
  },

  // Get shop video performance analytics for a date range (YYYY-MM-DD)
  getVideoAnalytics: async (id: string, from: string, to: string): Promise<VideoAnalyticsResponse> => {
    const query = new URLSearchParams({ from, to }).toString();
    return api.get(`${BASE_URL}/${id}/video-analytics?${query}`);
  },

  // Lấy sản phẩm đã bán của một loạt video (batch). Có cache + gọi song song ở backend.
  getVideoProducts: async (
    id: string,
    from: string,
    to: string,
    videoIds: string[]
  ): Promise<VideoProductsApiResponse> => {
    return api.post(`${BASE_URL}/${id}/video-analytics/products`, {
      from,
      to,
      videoIds,
    } as unknown as Record<string, unknown>);
  },

  // AFFILIATE: đồng bộ đơn affiliate `days` ngày gần nhất vào tab "<Tháng>-AFF"
  syncAffiliateOrders: async (
    id: string,
    days = 15,
  ): Promise<{ success: boolean; totalProcessed: number; shopName?: string }> => {
    return api.post(`${BASE_URL}/${id}/affiliate-orders/sync?days=${days}`, {});
  },

  // AFFILIATE: lấy danh sách đơn affiliate (enriched = chi tiết đầy đủ)
  getAffiliateOrders: async (
    id: string,
    days = 30,
    enriched = true,
  ): Promise<AffiliateOrdersApiResponse> => {
    const query = new URLSearchParams({
      days: String(days),
      enriched: String(enriched),
    }).toString();
    return api.get(`${BASE_URL}/${id}/affiliate-orders?${query}`);
  },
}; 