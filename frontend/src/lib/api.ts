import type {
  DashboardData,
  FriendRequestRecord,
  GroupInvitationRecord,
  GroupSentInvitationRecord,
  GroupMember,
  Group,
  NotificationRecord,
  PaginatedResponse,
  Project,
  PublicProfile,
  QuestRecord,
  Task,
  User,
} from '../types';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

type AuthStorageKey = 'nexora-user' | 'nexora-token';

function isStoredUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Partial<User>;

  return Number.isSafeInteger(user.id)
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && (user.public_id === undefined || typeof user.public_id === 'string');
}

function isStoredToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function removeAuthValue(key: AuthStorageKey): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function readAuthValue<T>(key: AuthStorageKey, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return null;

    const value: unknown = JSON.parse(raw);
    if (isValid(value)) return value;
  } catch {
    // Malformed JSON or inaccessible storage is treated as an absent session value.
  }

  removeAuthValue(key);
  return null;
}

function clearAuthentication(): void {
  if (typeof window === 'undefined') return;
  removeAuthValue('nexora-user');
  removeAuthValue('nexora-token');
}

function readAuthentication(): { user: User; token: string } | null {
  if (typeof window === 'undefined') return null;

  const user = readAuthValue('nexora-user', isStoredUser);
  const token = readAuthValue('nexora-token', isStoredToken);
  if (!user || !token) {
    clearAuthentication();
    return null;
  }

  return { user, token };
}

function storeAuthentication(user: unknown, token: unknown): void {
  if (typeof window === 'undefined' || !isStoredUser(user) || !isStoredToken(token)) {
    throw new Error('La respuesta de autenticación no es válida.');
  }

  try {
    window.sessionStorage.setItem('nexora-user', JSON.stringify(user));
    window.sessionStorage.setItem('nexora-token', JSON.stringify(token));
  } catch {
    clearAuthentication();
    throw new Error('No se pudo guardar la sesión en este navegador.');
  }
}

function storeCurrentUser(user: unknown): User {
  if (typeof window === 'undefined' || !isStoredUser(user)) {
    throw new Error('La respuesta del perfil no es válida.');
  }

  try {
    window.sessionStorage.setItem('nexora-user', JSON.stringify(user));
  } catch {
    clearAuthentication();
    throw new Error('No se pudo actualizar la sesión en este navegador.');
  }

  return user;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readAuthentication()?.token;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthentication();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nexora:session-expired'));
      }
    }
    const validationMessages = data?.errors && typeof data.errors === 'object'
      ? Object.values(data.errors as Record<string, unknown>)
          .flatMap(value => Array.isArray(value) ? value : [])
          .filter((value): value is string => typeof value === 'string')
      : [];
    const message = validationMessages[0] ?? data?.message ?? data?.error ?? 'La operación falló.';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function login(email: string, password: string) {
  const response = await request<{ user: User; token: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  storeAuthentication(response.user, response.token);

  return response;
}

export async function register(name: string, email: string, password: string) {
  const response = await request<{ user: User; token: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, password_confirmation: password }),
  });

  storeAuthentication(response.user, response.token);

  return response;
}

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/dashboard');
}

export async function getNotifications(page = 1): Promise<PaginatedResponse<NotificationRecord>> {
  return request<PaginatedResponse<NotificationRecord>>(`/notifications?page=${page}`);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await request<{ unread_count: number }>('/notifications/unread-count');
  return response.unread_count;
}

export async function searchUsers(search: string): Promise<PublicProfile[]> {
  return request<PublicProfile[]>(`/users?search=${encodeURIComponent(search)}`);
}

export async function getFriends(): Promise<PublicProfile[]> {
  return request<PublicProfile[]>('/friends');
}

export async function getFriendRequestsReceived(): Promise<FriendRequestRecord[]> {
  return request<FriendRequestRecord[]>('/friend-requests/received');
}

export async function getFriendRequestsSent(): Promise<FriendRequestRecord[]> {
  return request<FriendRequestRecord[]>('/friend-requests/sent');
}

export async function sendFriendRequest(publicId: string): Promise<void> {
  await request<{ id: number; status: string }>('/friend-requests', {
    method: 'POST',
    body: JSON.stringify({ public_id: publicId }),
  });
}

export async function respondToFriendRequest(
  requestId: number,
  response: 'accept' | 'reject',
): Promise<void> {
  await request<{ message: string }>(`/friend-requests/${requestId}/${response}`, {
    method: 'POST',
  });
}

export async function cancelFriendRequest(requestId: number): Promise<void> {
  await request<{ message: string }>(`/friend-requests/${requestId}`, { method: 'DELETE' });
}

export async function removeFriend(publicId: string): Promise<void> {
  await request<{ message: string }>(`/friends/${publicId}`, { method: 'DELETE' });
}

export async function markNotificationRead(notificationId: number): Promise<NotificationRecord> {
  const response = await request<{ message: string; notification: NotificationRecord }>(
    `/notifications/${notificationId}/read`,
    { method: 'PATCH' },
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexora:notifications-changed'));
  }
  return response.notification;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await request<{ message: string; updated_count: number }>(
    '/notifications/read-all',
    { method: 'PATCH' },
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexora:notifications-changed'));
  }
  return response.updated_count;
}

export async function getGroups(): Promise<Group[]> {
  return request<Group[]>('/groups');
}

export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
  return request<GroupMember[]>(`/groups/${groupId}/members`);
}

export async function inviteFriendToGroup(groupId: number, publicId: string): Promise<void> {
  await request<{ id: number; status: string }>(`/groups/${groupId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ invitee_public_id: publicId }),
  });
}

export async function getGroupInvitations(groupId: number): Promise<GroupSentInvitationRecord[]> {
  return request<GroupSentInvitationRecord[]>(`/groups/${groupId}/invitations`);
}

export async function cancelGroupInvitation(invitationId: number): Promise<void> {
  await request<{ message: string }>(`/group-invitations/${invitationId}`, { method: 'DELETE' });
}

export async function getReceivedGroupInvitations(): Promise<GroupInvitationRecord[]> {
  return request<GroupInvitationRecord[]>('/group-invitations/received');
}

export async function respondToGroupInvitation(
  invitationId: number,
  response: 'accept' | 'reject',
): Promise<void> {
  await request<{ message: string }>(`/group-invitations/${invitationId}/${response}`, {
    method: 'POST',
  });
}

export async function updateGroupMemberRole(
  groupId: number,
  publicId: string,
  role: 'Admin' | 'Member',
): Promise<void> {
  await request<{ public_id: string; role: string }>(`/groups/${groupId}/members/${publicId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeGroupMember(groupId: number, publicId: string): Promise<void> {
  await request<{ message: string }>(`/groups/${groupId}/members/${publicId}`, {
    method: 'DELETE',
  });
}

export async function leaveGroup(groupId: number): Promise<void> {
  await request<{ message: string; left: boolean }>(`/groups/${groupId}/membership`, {
    method: 'DELETE',
  });
}

export async function getQuests(page = 1): Promise<PaginatedResponse<QuestRecord>> {
  return request<PaginatedResponse<QuestRecord>>(`/quests?page=${page}`);
}

export async function createQuest(form: {
  title: string;
  description?: string | null;
  category: string;
  difficulty: QuestRecord['difficulty'];
  due_at?: string | null;
  reward_xp: number;
}): Promise<{ quest: QuestRecord }> {
  return request<{ quest: QuestRecord }>('/quests', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function joinQuest(questId: number): Promise<void> {
  await request<{ progress: number; completed: boolean }>(`/quests/${questId}/join`, { method: 'POST' });
}

export async function updateQuestProgress(
  questId: number,
  progress: number,
): Promise<{ progress: number; completed: boolean; xp_awarded: number; xp_total: number }> {
  return request(`/quests/${questId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ progress }),
  });
}

export async function createGroup(form: { name: string; description?: string }) {
  return request<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function updateGroup(
  groupId: number,
  form: { name: string; description: string | null },
): Promise<Group> {
  return request<Group>(`/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(form),
  });
}

export async function getProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export async function getArchivedProjects(): Promise<Project[]> {
  return request<Project[]>('/projects/archived');
}

export async function archiveProject(projectId: number): Promise<{ message: string; project: Project }> {
  return request<{ message: string; project: Project }>(`/projects/${projectId}/archive`, {
    method: 'POST',
  });
}

export async function restoreProject(projectId: number): Promise<{ message: string; project: Project }> {
  return request<{ message: string; project: Project }>(`/projects/${projectId}/restore`, {
    method: 'POST',
  });
}

export async function createProject(form: { name: string; description?: string; status: string; priority: string; group_id?: number | null; due_at?: string | null }) {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function updateProject(projectId: number, form: {
  name?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  group_id?: number | null;
  due_at?: string | null;
}): Promise<Project> {
  return request<Project>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(form),
  });
}

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export type TaskFormData = {
  title: string;
  description?: string | null;
  project_id: number;
  assignee_public_id?: string | null;
  status: string;
  priority: string;
  due_at?: string | null;
};

export async function createTask(form: TaskFormData) {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function updateTask(taskId: number, form: Partial<TaskFormData>): Promise<Task> {
  return request<Task>(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(form),
  });
}

export async function deleteTask(taskId: number): Promise<void> {
  await request<{ message: string }>(`/tasks/${taskId}`, { method: 'DELETE' });
}

export function getCurrentUser(): User | null {
  return readAuthentication()?.user ?? null;
}

export async function getProfile(): Promise<User> {
  const user = await request<User>('/user');
  return storeCurrentUser(user);
}

export async function updateProfile(form: {
  name?: string;
  avatar_url?: string | null;
  bio?: string | null;
}): Promise<User> {
  const response = await request<{ message: string; user: User }>('/profile', {
    method: 'PUT',
    body: JSON.stringify(form),
  });
  return storeCurrentUser(response.user);
}

export async function updatePassword(form: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<string> {
  const response = await request<{ message: string }>('/profile/password', {
    method: 'PUT',
    body: JSON.stringify(form),
  });
  clearAuthentication();
  return response.message;
}

export async function logout(): Promise<void> {
  try {
    await request<{ message: string }>('/logout', { method: 'POST' });
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) {
      throw err;
    }
  }
  clearAuthentication();
}
