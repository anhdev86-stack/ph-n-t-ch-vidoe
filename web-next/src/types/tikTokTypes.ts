export interface ShopCipher {
  cipher: string;
  code: string;
  id: string;
  name: string;
  region: string;
  seller_type: string;
}

export interface Task {
  cronExpression: string;
  lastRun: Date;
  isActive: boolean;
}

export interface TikTokAccount {
  _id?: string;
  id?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpireIn?: number;
  refreshTokenExpireIn?: number;
  // Các trường bí mật KHÔNG được backend trả về nữa (đã lọc phía server)
  authCode?: string;
  appSecret?: string;
  appKey: string;
  serviceId?: string;
  shopCipher?: ShopCipher[];
  status: boolean;
  task?: Task;
  sheetId?: string;
  sheetEmails?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExtractedVideoItem {
  videoId: string;
  videoLink: string;
  title: string;
  username: string;
  gmv: number;
  currency: string;
  skuOrders: number;
  itemsSold: number;
  views: number;
  ctr: number;
  postedAt: string;
}

export interface ExtractedVideoProduct {
  productId: string;
  productName: string;
  gmv: number;
  unitsSold: number;
}

export interface VideoProductsApiResponse {
  products: Record<string, ExtractedVideoProduct[]>;
}

export interface VideoAnalyticsResponse {
  kpis: {
    totalVideos: number;
    totalGmv: number;
    totalViews: number;
    avgCtr: number;
  };
  currency: string;
  videos: ExtractedVideoItem[];
}

export interface PaginationType {
  current: number;
  pageSize: number;
  total: number;
}

export interface CreateAccountDto {
  authCode: string;
  appSecret: string;
  appKey: string;
  serviceId: string;
  sheetId?: string;
  sheetEmails?: string[];
}

export interface UpdateAccountDto {
  authCode?: string;
  appSecret?: string;
  appKey?: string;
  serviceId?: string;
  sheetId?: string;
  sheetEmails?: string[];
  status?: boolean;
}

export interface UpdateTaskDto {
  cronExpression?: string;
  lastRun?: Date;
  isActive?: boolean;
} 
// ===== AFFILIATE =====
export interface AffiliateOrderItem {
  order_id: string;
  order_status?: string;
  product_name?: string;
  sku_id?: string;
  variation?: string;
  quantity?: string;
  order_amount?: string;
  created_time?: string;
  user_id?: string;
  is_affiliate?: boolean;
  [key: string]: unknown;
}

export interface AffiliateOrdersApiResponse {
  success: boolean;
  accountId: string;
  shopName?: string;
  windowDays: number;
  enriched: boolean;
  count: number;
  orders: AffiliateOrderItem[];
}
