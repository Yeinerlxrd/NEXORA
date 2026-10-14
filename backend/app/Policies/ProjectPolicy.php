<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        if ($project->creator_id === $user->id) {
            return true;
        }

        if ($project->group_id !== null) {
            return $project->group->members()->where('users.id', $user->id)->exists();
        }

        return false;
    }

    public function update(User $user, Project $project): bool
    {
        return $project->creator_id === $user->id;
    }

    public function delete(User $user, Project $project): bool
    {
        return $project->creator_id === $user->id;
    }
}
