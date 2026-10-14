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

    public function delete(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id;
    }
}
