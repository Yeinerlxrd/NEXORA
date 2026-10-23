<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Http\Resources\TaskResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'search' => ['sometimes', 'string', 'max:150'],
            'status' => ['sometimes', 'in:Pendiente,En progreso,En revisión,Completada'],
            'priority' => ['sometimes', 'in:Baja,Media,Alta,Urgente'],
        ]);

        $user = $request->user();

        $query = Task::with([
            'project:id,name',
            'creator:id,public_id,name,avatar_url,bio',
            'assignee:id,public_id,name,avatar_url,bio',
        ])
            ->where(function ($query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhere('assignee_id', $user->id)
                    ->orWhereHas('project', function ($projectQuery) use ($user) {
                        $projectQuery->where('creator_id', $user->id)
                            ->orWhereHas('group.members', function ($memberQuery) use ($user) {
                                $memberQuery->where('users.id', $user->id);
                            });
                    });
            })
            ->whereHas('project', fn ($projectQuery) => $projectQuery->whereNull('archived_at'));

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        return response()->json(TaskResource::collection($query->orderBy('due_at')->get())->resolve($request));
    }

    public function store(Request $request)
    {
        $this->ensureSingleAssigneeIdentifier($request);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'assignee_public_id' => ['nullable', 'uuid', 'exists:users,public_id'],
            'status' => ['required', 'in:Pendiente,En progreso,En revisión,Completada'],
            'priority' => ['required', 'in:Baja,Media,Alta,Urgente'],
            'due_at' => ['nullable', 'date'],
        ]);

        $project = Project::with('group')->findOrFail($data['project_id']);

        if (! $this->userCanAccessProject($request->user(), $project)) {
            abort(403, 'No tienes permiso para crear tareas en este proyecto.');
        }
        abort_if($project->archived_at !== null, 409, 'No se pueden crear tareas en un proyecto archivado.');

        $assignee = $this->requestedAssignee($data);
        $data['assignee_id'] = $assignee?->id;
        unset($data['assignee_public_id']);

        if ($assignee && ! $this->userCanAccessProject($assignee, $project)) {
            abort(403, 'La persona asignada no pertenece al proyecto.');
        }

        $data['creator_id'] = $request->user()->id;

        $task = Task::create($data);

        return response()->json(TaskResource::make($task->fresh([
            'project:id,name',
            'creator:id,public_id,name,avatar_url,bio',
            'assignee:id,public_id,name,avatar_url,bio',
        ]))->resolve($request), 201);
    }

    public function show(Request $request, Task $task)
    {
        Gate::authorize('view', $task);

        return response()->json(TaskResource::make($task->load([
            'project:id,name',
            'creator:id,public_id,name,avatar_url,bio',
            'assignee:id,public_id,name,avatar_url,bio',
        ]))->resolve($request));
    }

    public function update(Request $request, Task $task)
    {
        Gate::authorize('update', $task);
        $this->ensureSingleAssigneeIdentifier($request);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'project_id' => ['sometimes', 'integer', 'exists:projects,id'],
            'status' => ['sometimes', 'in:Pendiente,En progreso,En revisión,Completada'],
            'priority' => ['sometimes', 'in:Baja,Media,Alta,Urgente'],
            'assignee_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'assignee_public_id' => ['sometimes', 'nullable', 'uuid', 'exists:users,public_id'],
            'due_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $targetProject = $task->project;
        $projectChanged = array_key_exists('project_id', $data)
            && (int) $data['project_id'] !== $task->project_id;
        if ($projectChanged) {
            $targetProject = Project::with('group')->findOrFail($data['project_id']);
            if (! $this->userCanAccessProject($request->user(), $targetProject)) {
                abort(403, 'No tienes permisos para mover esta tarea a ese proyecto.');
            }
            abort_if($targetProject->archived_at !== null, 409, 'No se pueden mover tareas a un proyecto archivado.');
        }

        $assignmentWasProvided = array_key_exists('assignee_id', $data) || array_key_exists('assignee_public_id', $data);
        $assignee = $assignmentWasProvided
            ? $this->requestedAssignee($data)
            : ($projectChanged ? $task->assignee : null);
        if ($assignmentWasProvided) {
            $data['assignee_id'] = $assignee?->id;
            unset($data['assignee_public_id']);
        }

        if ($assignee && ! $this->userCanAccessProject($assignee, $targetProject)) {
            abort(403, 'La persona asignada no pertenece al proyecto.');
        }

        $task->fill($data)->save();

        return response()->json(TaskResource::make($task->fresh([
            'project:id,name',
            'creator:id,public_id,name,avatar_url,bio',
            'assignee:id,public_id,name,avatar_url,bio',
        ]))->resolve($request));
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

    private function requestedAssignee(array $data): ?User
    {
        if (array_key_exists('assignee_public_id', $data)) {
            return $data['assignee_public_id'] === null
                ? null
                : User::query()->where('public_id', $data['assignee_public_id'])->firstOrFail();
        }

        return empty($data['assignee_id']) ? null : User::findOrFail($data['assignee_id']);
    }

    private function ensureSingleAssigneeIdentifier(Request $request): void
    {
        $input = $request->all();
        if (array_key_exists('assignee_id', $input) && array_key_exists('assignee_public_id', $input)) {
            throw ValidationException::withMessages([
                'assignee_public_id' => ['Envía un solo identificador para la persona asignada.'],
            ]);
        }
    }
}
