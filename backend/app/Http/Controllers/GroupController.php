<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Http\Resources\GroupResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class GroupController extends Controller
{
    public function index(Request $request)
    {
        $groups = $request->user()->groups()
                ->with('owner:id,public_id,name,avatar_url,bio')
                ->withCount('members')
                ->get(['groups.id', 'groups.owner_id', 'groups.name', 'groups.description', 'groups.created_at', 'groups.updated_at']);

        return response()->json(GroupResource::collection($groups)->resolve($request));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $group = DB::transaction(function () use ($data, $request) {
            $group = Group::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'owner_id' => $request->user()->id,
            ]);

            $group->members()->attach($request->user()->id, ['role' => 'Owner']);

            return $group;
        });

        return response()->json(GroupResource::make($group->load(['owner:id,public_id,name,avatar_url,bio'])->loadCount('members'))->resolve($request), 201);
    }

    public function show(Request $request, Group $group)
    {
        Gate::authorize('view', $group);

        return response()->json(GroupResource::make($group->load([
            'members:id,public_id,name,avatar_url,bio',
            'owner:id,public_id,name,avatar_url,bio',
            'projects:id,group_id,name,description,status,priority,due_at,archived_at',
        ])->loadCount('members'))->resolve($request));
    }

    public function update(Request $request, Group $group)
    {
        Gate::authorize('update', $group);

        $group->fill($request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]))->save();

        return response()->json(GroupResource::make($group->fresh(['owner:id,public_id,name,avatar_url,bio'])->loadCount('members'))->resolve($request));
    }

    public function destroy(Request $request, Group $group)
    {
        Gate::authorize('delete', $group);
        $group->delete();

        return response()->json(['message' => 'Grupo eliminado.']);
    }
}
