export type User = {
  id: number;
  public_id?: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  bio?: string | null;
  xp_total?: number;
};

export type PublicProfile = {
  public_id: string;
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
};

export type FriendRequestRecord = {
  id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  created_at: string;
  user: PublicProfile;
};

export type GroupMember = PublicProfile & {
  role: 'Owner' | 'Admin' | 'Member';
};

export type GroupInvitationRecord = {
  id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string | null;
  group: Pick<Group, 'id' | 'name' | 'description'>;
  inviter: Pick<PublicProfile, 'public_id' | 'name' | 'avatar_url'>;
};

export type GroupSentInvitationRecord = {
  id: number;
  status: 'pending';
  expires_at: string | null;
  invitee: Pick<PublicProfile, 'public_id' | 'name' | 'avatar_url'>;
};

export type QuestRecord = {
  id: number;
  title: string;
  description?: string | null;
  category: string;
  difficulty: 'Fácil' | 'Media' | 'Difícil';
  due_at: string | null;
  reward_xp: number;
  participants_count: number;
  creator: Pick<PublicProfile, 'public_id' | 'name' | 'avatar_url'>;
  joined: boolean;
  my_progress: number | null;
  completed: boolean;
};

export type Task = {
  id: number;
  project_id: number;
  title: string;
  description?: string | null;
  status: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completada';
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  due_at?: string | null;
  creator?: PublicProfile;
  assignee?: PublicProfile | null;
  project?: { id: number; name: string } | null;
};

export type Project = {
  id: number;
  creator_public_id?: string;
  group_id?: number | null;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  due_at?: string | null;
  archived_at?: string | null;
  creator?: PublicProfile;
  group?: { id: number; name: string } | null;
};

export type Group = {
  id: number;
  owner_public_id?: string;
  name: string;
  description?: string | null;
  members_count?: number;
};

export type NotificationRecord = {
  id: number;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type DashboardData = {
  hello: string;
  date: string;
  summary: { pending_tasks: number; projects: number; groups: number; upcoming_tasks: number };
  upcoming_tasks: Task[];
  recent_projects: Project[];
  recent_groups: Group[];
  quick_links: { label: string; href: string }[];
  notifications: NotificationRecord[];
};
