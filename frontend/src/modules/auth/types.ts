export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: Role[];
  is_active: boolean;
  is_staff: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}
