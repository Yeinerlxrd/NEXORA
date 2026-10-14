import type { DashboardData, Group, Project, Task, User } from '../types';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

function storage<T>(key: string, value?: T): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (value === undefined) {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  window.sessionStorage.setItem(key, JSON.stringify(value));
  return value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storage<string>('nexora-token');

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message ?? data?.error ?? 'La operación falló.';
    throw new Error(message);
  }

  return data as T;
}

export async function login(email: string, password: string) {
  const response = await request<{ user: User; token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  storage('nexora-user', response.user);
  storage('nexora-token', response.token);

  return response;
}

export async function register(name: string, email: string, password: string) {
  const response = await request<{ user: User; token: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, password_confirmation: password }),
  });

  storage('nexora-user', response.user);
  storage('nexora-token', response.token);

  return response;
}

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/dashboard');
}

export async function getGroups(): Promise<Group[]> {
  return request<Group[]>('/groups');
}

export async function createGroup(form: { name: string; description?: string }) {
  return request<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function getProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export async function createProject(form: { name: string; description?: string; status: string; priority: string; group_id?: number | null; due_at?: string | null }) {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export async function createTask(form: { title: string; description?: string; project_id: number; assignee_id?: number | null; status: string; priority: string; due_at?: string | null }) {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export function getCurrentUser(): User | null {
  return storage<User>('nexora-user');
}

export function logout() {
  window.sessionStorage.removeItem('nexora-user');
  window.sessionStorage.removeItem('nexora-token');
}
