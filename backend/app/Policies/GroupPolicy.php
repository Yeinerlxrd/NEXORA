<?php

namespace App\Policies;

use App\Models\Group;
use App\Models\User;

class GroupPolicy
{
    public function view(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id || $group->members()->where('users.id', $user->id)->exists();
    }

    public function update(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id || ($group->members()->where('users.id', $user->id)->wherePivot('role', 'Admin')->exists());
    }

    public function invite(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id
            || $group->members()
                ->where('users.id', $user->id)
                ->wherePivotIn('role', ['Owner', 'Admin'])
                ->exists();
    }

    public function manageMembers(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id;
    }

    public function removeMember(User $user, Group $group, User $member): bool
    {
        if ($group->owner_id === $user->id) {
            return $member->id !== $group->owner_id;
        }

        return $group->members()
            ->where('users.id', $user->id)
            ->wherePivot('role', 'Admin')
            ->exists()
            && $group->members()
                ->where('users.id', $member->id)
                ->wherePivot('role', 'Member')
                ->exists();
    }

    public function delete(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id;
    }
}
