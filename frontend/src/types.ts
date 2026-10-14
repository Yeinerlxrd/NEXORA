export type User = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  bio?: string | null;
};

export type Task = {
  id: number;
  title: string;
  description?: string;
  status: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completada';
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  due_at?: string | null;
  assignee?: User | null;
  project?: { id: number; name: string } | null;
};

export type Project = {
  id: number;
  name: string;
  description?: string;
  status: string;
  priority: string;
  due_at?: string | null;
  creator?: User;
};

export type Group = {
  id: number;
  name: string;
  description?: string | null;
  members_count?: number;
};

export type DashboardData = {
  hello: string;
  date: string;
  summary: { pending_tasks: number; projects: number; groups: number };
  upcoming_tasks: Task[];
  recent_projects: Project[];
  recent_groups: Group[];
  quick_links: { label: string; href: string }[];
  notifications: { id: number; title: string; message: string }[];
};
