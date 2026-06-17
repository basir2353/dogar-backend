import type { ApiResponse } from "../shared/index.js";

export const ok = <T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> => ({
  success: true,
  data,
  meta
});

export const fail = (code: string, message: string): ApiResponse<never> => ({
  success: false,
  error: { code, message }
});
