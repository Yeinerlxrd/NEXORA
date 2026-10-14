<?php

namespace App\Http\Controllers;

use App\Models\Group;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class GroupController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->groups()->with('owner')->withCount('members')->get()
        );
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

        return response()->json($group->load('members', 'owner'), 201);
    }

    public function show(Request $request, Group $group)
    {
        Gate::authorize('view', $group);

        return response()->json($group->load('members', 'projects', 'owner'));
    }

    public function update(Request $request, Group $group)
    {
        Gate::authorize('update', $group);

        $group->fill($request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]))->save();

        return response()->json($group->fresh());
    }

    public function destroy(Request $request, Group $group)
    {
        Gate::authorize('delete', $group);
        $group->delete();

        return response()->json(['message' => 'Grupo eliminado.']);
    }
}
