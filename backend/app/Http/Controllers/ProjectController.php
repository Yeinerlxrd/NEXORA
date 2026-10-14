<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Project::query()->with('creator', 'group', 'tasks')
            ->where(function ($query) use ($user) {
                $query->where('creator_id', $user->id)
                    ->orWhere(function ($groupQuery) use ($user) {
                        $groupQuery->whereNotNull('group_id')->whereHas('group.members', function ($memberQuery) use ($user) {
                            $memberQuery->where('users.id', $user->id);
                        });
                    });
            });

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        return response()->json($query->orderByDesc('updated_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', 'in:Planificación,En progreso,En revisión,Completado,Archivado'],
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

        return response()->json($project->fresh(), 201);
    }

    public function show(Request $request, Project $project)
    {
        Gate::authorize('view', $project);

        return response()->json($project->load('creator', 'group', 'tasks'));
    }

    public function update(Request $request, Project $project)
    {
        Gate::authorize('update', $project);

        $project->fill($request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:Planificación,En progreso,En revisión,Completado,Archivado'],
            'priority' => ['sometimes', 'in:Baja,Media,Alta,Urgente'],
            'due_at' => ['sometimes', 'nullable', 'date'],
        ]))->save();

        return response()->json($project->fresh());
    }

    public function destroy(Request $request, Project $project)
    {
        Gate::authorize('delete', $project);
        $project->delete();

        return response()->json(['message' => 'Proyecto archivado y eliminado.']);
    }
}
