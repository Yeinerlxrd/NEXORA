<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        if ($task->creator_id === $user->id || $task->assignee_id === $user->id) {
            return true;
        }

        if ($task->project && $task->project->group_id !== null) {
            return $task->project->group->members()->where('users.id', $user->id)->exists();
        }

        return false;
    }

    public function update(User $user, Task $task): bool
    {
        return $task->creator_id === $user->id || $task->assignee_id === $user->id;
    }

    public function delete(User $user, Task $task): bool
    {
        return $task->creator_id === $user->id;
    }
}
