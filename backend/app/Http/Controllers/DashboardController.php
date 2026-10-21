<?php

namespace App\Http\Controllers;

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
            ->whereIn('status', ['Pendiente', 'En progreso'])
            ->whereHas('project', fn ($query) => $query->whereNull('archived_at'))
            ->count();

        $upcomingTasks = Task::with('project')
            ->where('assignee_id', $user->id)
            ->where('due_at', '>=', now())
            ->whereHas('project', fn ($query) => $query->whereNull('archived_at'))
            ->orderBy('due_at')
            ->limit(5)
            ->get();

        $recentProjects = Project::with('group')
            ->whereNull('archived_at')
            ->where(function ($query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhereHas('group.members', fn ($memberQuery) => $memberQuery->where('users.id', $user->id));
            })
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get();

        $recentGroups = Group::whereHas('members', fn ($query) => $query->where('users.id', $user->id))
            ->withCount('members')
            ->orderByDesc('updated_at')
            ->limit(4)
            ->get();

        return response()->json([
            'hello' => 'Hola, ' . $user->name,
            'date' => now()->translatedFormat('l, d \d\e F \d\e Y'),
            'summary' => [
                'pending_tasks' => $tasksPending,
                'projects' => Project::where('creator_id', $user->id)->whereNull('archived_at')->count(),
                'groups' => $user->groups()->count(),
            ],
            'upcoming_tasks' => $upcomingTasks,
            'recent_projects' => $recentProjects,
            'recent_groups' => $recentGroups,
            'quick_links' => [
                ['label' => 'Crear proyecto', 'href' => '/projects'],
                ['label' => 'Ver tareas', 'href' => '/tasks'],
                ['label' => 'Mis grupos', 'href' => '/groups'],
            ],
            'notifications' => $user->notifications()->latest()->limit(3)->get(),
        ]);
    }
}
