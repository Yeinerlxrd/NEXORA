<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class GroupMemberController extends Controller
{
    public function index(Request $request, Group $group)
    {
        $this->authorize('view', $group);

        $members = $group->members()
            ->select(['users.id', 'users.public_id', 'users.name', 'users.avatar_url', 'users.bio'])
            ->orderBy('users.name')
            ->get()
            ->map(fn (User $member): array => [
                ...$member->only(['public_id', 'name', 'avatar_url', 'bio']),
                'role' => $member->pivot->role,
            ])
            ->values();

        return response()->json($members);
    }

    public function update(Request $request, Group $group, User $member)
    {
        $this->authorize('manageMembers', $group);
        $data = $request->validate([
            'role' => ['required', 'in:Admin,Member'],
        ]);
        $currentMember = $group->members()->where('users.id', $member->id)->first();
        abort_unless($currentMember, 404);

        if ($member->id === $group->owner_id && $data['role'] !== 'Owner') {
            throw new ConflictHttpException('El propietario actual no puede perder su permiso de propietario.');
        }

        $group->members()->updateExistingPivot($member->id, ['role' => $data['role']]);

        return response()->json([
            'public_id' => $member->public_id,
            'role' => $data['role'],
        ]);
    }

    public function destroy(Request $request, Group $group, User $member)
    {
        abort_unless($group->members()->where('users.id', $member->id)->exists(), 404);
        $this->authorize('removeMember', [$group, $member]);
        $group->members()->detach($member->id);

        return response()->json(['message' => 'Miembro eliminado del grupo.']);
    }

    public function leave(Request $request, Group $group)
    {
        $user = $request->user();

        $left = DB::transaction(function () use ($group, $user): bool {
            $lockedGroup = Group::query()->lockForUpdate()->findOrFail($group->id);
            $membership = $lockedGroup->members()
                ->where('users.id', $user->id)
                ->first();

            abort_unless($membership, 404);

            if ($membership->pivot->role === 'Owner') {
                $successor = $lockedGroup->members()
                    ->where('users.id', '<>', $user->id)
                    ->wherePivotIn('role', ['Owner', 'Admin'])
                    ->orderByRaw("CASE WHEN group_members.role = 'Owner' THEN 0 ELSE 1 END")
                    ->first();

                if (! $successor) {
                    throw new ConflictHttpException('El último propietario no puede abandonar el grupo.');
                }

                if ($successor->pivot->role !== 'Owner') {
                    $lockedGroup->members()->updateExistingPivot($successor->id, ['role' => 'Owner']);
                }

                $lockedGroup->update(['owner_id' => $successor->id]);
            }

            $lockedGroup->members()->detach($user->id);

            return true;
        });

        return response()->json(['message' => 'Has salido del grupo.', 'left' => $left]);
    }
}
