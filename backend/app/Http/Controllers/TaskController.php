<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Task::with('project', 'creator', 'assignee')
            ->where(function ($query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhere('assignee_id', $user->id)
                    ->orWhereHas('project', function ($projectQuery) use ($user) {
                        $projectQuery->where('creator_id', $user->id)
                            ->orWhereHas('group.members', function ($memberQuery) use ($user) {
                                $memberQuery->where('users.id', $user->id);
                            });
                    });
            });

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        return response()->json($query->orderBy('due_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['required', 'in:Pendiente,En progreso,En revisión,Completada'],
            'priority' => ['required', 'in:Baja,Media,Alta,Urgente'],
            'due_at' => ['nullable', 'date'],
        ]);

        $project = Project::with('group')->findOrFail($data['project_id']);

        if (! $this->userCanAccessProject($request->user(), $project)) {
            abort(403, 'No tienes permiso para crear tareas en este proyecto.');
        }

        if (! empty($data['assignee_id']) && ! $this->userCanAccessProject(User::findOrFail($data['assignee_id']), $project)) {
            abort(403, 'La persona asignada no pertenece al proyecto.');
        }

        $data['creator_id'] = $request->user()->id;

        $task = Task::create($data);

        return response()->json($task->fresh(), 201);
    }

    public function show(Request $request, Task $task)
    {
        Gate::authorize('view', $task);

        return response()->json($task->load('project', 'creator', 'assignee'));
    }

    public function update(Request $request, Task $task)
    {
        Gate::authorize('update', $task);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'status' => ['sometimes', 'in:Pendiente,En progreso,En revisión,Completada'],
            'priority' => ['sometimes', 'in:Baja,Media,Alta,Urgente'],
            'assignee_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'due_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (! empty($data['assignee_id']) && ! $this->userCanAccessProject(User::findOrFail($data['assignee_id']), $task->project)) {
            abort(403, 'La persona asignada no pertenece al proyecto.');
        }

        $task->fill($data)->save();

        return response()->json($task->fresh());
    }

    public function destroy(Request $request, Task $task)
    {
        Gate::authorize('delete', $task);
        $task->delete();

        return response()->json(['message' => 'Tarea eliminada.']);
    }

    private function userCanAccessProject(User $user, Project $project): bool
    {
        return $project->creator_id === $user->id
            || ($project->group?->members()->whereKey($user->id)->exists() ?? false);
    }
}
