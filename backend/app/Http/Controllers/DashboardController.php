<?php

namespace App\Http\Controllers;

use App\Http\Resources\GroupResource;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\TaskResource;
use App\Models\Group;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $tasksPending = Task::where('assignee_id', $user->id)
            ->whereIn('status', ['Pendiente', 'En progreso', 'En revisión'])
            ->whereHas('project', fn ($query) => $query->whereNull('archived_at'))
            ->count();

        $upcomingTaskQuery = Task::query()
            ->where('assignee_id', $user->id)
            ->where('status', '<>', 'Completada')
            ->whereDate('due_at', '>=', today()->toDateString())
            ->whereHas('project', fn ($query) => $query->whereNull('archived_at'));
        $upcomingTasksCount = (clone $upcomingTaskQuery)->count();

        $upcomingTasks = (clone $upcomingTaskQuery)
            ->with('project:id,name')
            ->orderBy('due_at')
            ->limit(5)
            ->get()
            ->map(fn (Task $task): array => TaskResource::make($task)->resolve($request))
            ->values();

        $recentProjects = Project::with(['group:id,name', 'creator:id,public_id,name,avatar_url,bio'])
            ->whereNull('archived_at')
            ->where(function ($query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhereHas('group.members', fn ($memberQuery) => $memberQuery->where('users.id', $user->id));
            })
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get()
            ->map(fn (Project $project): array => ProjectResource::make($project)->resolve($request))
            ->values();

        $recentGroups = Group::whereHas('members', fn ($query) => $query->where('users.id', $user->id))
            ->with('owner:id,public_id,name,avatar_url,bio')
            ->withCount('members')
            ->orderByDesc('updated_at')
            ->limit(4)
            ->get()
            ->map(fn (Group $group): array => GroupResource::make($group)->resolve($request))
            ->values();

        $recentNotifications = $user->notifications()->latest()->limit(3)->get()
            ->map(fn ($notification): array => $notification->only(['id', 'title', 'message', 'type', 'read_at', 'created_at']))
            ->values();

        return response()->json([
            'hello' => 'Hola, '.$user->name,
            'date' => now()->translatedFormat('l, d \d\e F \d\e Y'),
            'summary' => [
                'pending_tasks' => $tasksPending,
                'projects' => Project::where('creator_id', $user->id)->whereNull('archived_at')->count(),
                'groups' => $user->groups()->count(),
                'upcoming_tasks' => $upcomingTasksCount,
            ],
            'upcoming_tasks' => $upcomingTasks,
            'recent_projects' => $recentProjects,
            'recent_groups' => $recentGroups,
            'quick_links' => [
                ['label' => 'Crear proyecto', 'href' => '/projects'],
                ['label' => 'Ver tareas', 'href' => '/tasks'],
                ['label' => 'Mis grupos', 'href' => '/groups'],
            ],
            'notifications' => $recentNotifications,
        ]);
    }
}
