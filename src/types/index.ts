/** Shared TypeScript types used across the app layer */

export type UserRole = 'supplier' | 'consultant' | 'admin';

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type PaginatedResponse<T> = {
  success: true;
  data: readonly T[];
  meta: { total: number; page: number; limit: number };
};
