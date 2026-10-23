<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\User;
use App\Http\Resources\ProjectResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'search' => ['sometimes', 'string', 'max:120'],
            'status' => ['sometimes', 'in:Planificación,En progreso,En revisión,Completado'],
            'priority' => ['sometimes', 'in:Baja,Media,Alta,Urgente'],
        ]);

        $query = $this->projectsVisibleTo($request->user())
            ->whereNull('archived_at');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        return response()->json(ProjectResource::collection($query->orderByDesc('updated_at')->get())->resolve($request));
    }

    public function archived(Request $request)
    {
        $projects = $this->projectsVisibleTo($request->user())
            ->whereNotNull('archived_at')
            ->orderByDesc('archived_at')
            ->get();

        return response()->json(ProjectResource::collection($projects)->resolve($request));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', 'in:Planificación,En progreso,En revisión,Completado'],
            'priority' => ['required', 'in:Baja,Media,Alta,Urgente'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'due_at' => ['nullable', 'date'],
        ]);

        if (! empty($data['group_id'])) {
            $group = $request->user()->groups()->whereKey($data['group_id'])->first();
            if (! $group) {
                abort(403, 'No tienes permisos para crear proyectos en este grupo.');
            }
        }

        $data['creator_id'] = $request->user()->id;

        $project = Project::create($data);

        return response()->json(ProjectResource::make($project->fresh(['creator', 'group']))->resolve($request), 201);
    }

    public function show(Request $request, Project $project)
    {
        Gate::authorize('view', $project);

        return response()->json(ProjectResource::make($project->load([
            'creator:id,public_id,name,avatar_url,bio',
            'group:id,name',
            'tasks' => fn ($query) => $query->select([
                'id', 'project_id', 'creator_id', 'assignee_id', 'title', 'description',
                'status', 'priority', 'due_at', 'created_at', 'updated_at',
            ]),
            'tasks.creator:id,public_id,name,avatar_url,bio',
            'tasks.assignee:id,public_id,name,avatar_url,bio',
        ]))->resolve($request));
    }

    public function update(Request $request, Project $project)
    {
        Gate::authorize('update', $project);
        abort_if($project->archived_at !== null, 409, 'Restaura el proyecto antes de modificarlo.');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:Planificación,En progreso,En revisión,Completado'],
            'priority' => ['sometimes', 'in:Baja,Media,Alta,Urgente'],
            'group_id' => ['sometimes', 'nullable', 'integer', 'exists:groups,id'],
            'due_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('group_id', $data)) {
            $groupId = $data['group_id'];
            if ($groupId !== null && ! $request->user()->groups()->whereKey($groupId)->exists()) {
                abort(403, 'No tienes permisos para vincular el proyecto a este grupo.');
            }
        }

        $project->fill($data)->save();

        return response()->json(ProjectResource::make($project->fresh(['creator', 'group']))->resolve($request));
    }

    public function archive(Request $request, Project $project)
    {
        Gate::authorize('update', $project);

        $archivedAt = now();
        $updated = Project::query()
            ->whereKey($project->getKey())
            ->whereNull('archived_at')
            ->update(['archived_at' => $archivedAt, 'updated_at' => $archivedAt]);
        abort_if($updated !== 1, 409, 'El proyecto ya está archivado.');
        $project->refresh();

        return response()->json([
            'message' => 'Proyecto archivado. Sus tareas se conservaron.',
            'project' => ProjectResource::make($project->load(['creator', 'group']))->resolve($request),
        ]);
    }

    public function restore(Request $request, Project $project)
    {
        Gate::authorize('update', $project);

        $updated = Project::query()
            ->whereKey($project->getKey())
            ->whereNotNull('archived_at')
            ->update(['archived_at' => null, 'updated_at' => now()]);
        abort_if($updated !== 1, 409, 'El proyecto no está archivado.');
        $project->refresh();

        return response()->json([
            'message' => 'Proyecto restaurado.',
            'project' => ProjectResource::make($project->load(['creator', 'group']))->resolve($request),
        ]);
    }

    public function destroy(Request $request, Project $project)
    {
        Gate::authorize('delete', $project);

        return response()->json([
            'message' => 'La eliminación física de proyectos está deshabilitada. Usa la operación de archivo.',
        ], 409);
    }

    private function projectsVisibleTo(User $user): Builder
    {
        return Project::query()
            ->with(['group:id,name', 'creator:id,public_id,name,avatar_url,bio'])
            ->where(function (Builder $query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhere(function (Builder $groupQuery) use ($user) {
                        $groupQuery->whereNotNull('group_id')
                            ->whereHas('group.members', function (Builder $memberQuery) use ($user) {
                                $memberQuery->where('users.id', $user->id);
                            });
                    });
            });
    }
}
