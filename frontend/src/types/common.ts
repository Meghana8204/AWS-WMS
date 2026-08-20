export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface BaseModel {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_active: boolean;
}
