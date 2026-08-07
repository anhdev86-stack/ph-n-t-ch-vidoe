import { api } from "../lib/api";

export interface ServiceAccount {
  _id?: string;
  client_email: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateServiceAccountDto {
  credentials: Record<string, unknown>;
  description?: string;
  isActive?: boolean;
}

export interface UpdateServiceAccountDto {
  description?: string;
  isActive?: boolean;
}

const BASE_URL = "/service-account";

export const serviceAccountService = {
  getAll: async (): Promise<ServiceAccount[]> => {
    const response = await api.get(BASE_URL);
    return response as ServiceAccount[];
  },

  create: async (data: CreateServiceAccountDto): Promise<ServiceAccount> => {
    const response = await api.post(
      BASE_URL,
      data as unknown as Record<string, unknown>,
    );
    return response as ServiceAccount;
  },

  update: async (
    id: string,
    data: UpdateServiceAccountDto,
  ): Promise<ServiceAccount> => {
    const response = await api.patch(
      `${BASE_URL}/${id}`,
      data as unknown as Record<string, unknown>,
    );
    return response as ServiceAccount;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  },
};
