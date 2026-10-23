<?php

namespace App\Policies;

use App\Models\FriendRequest;
use App\Models\User;

class FriendRequestPolicy
{
    public function respond(User $user, FriendRequest $friendRequest): bool
    {
        return $friendRequest->recipient_id === $user->id;
    }

    public function cancel(User $user, FriendRequest $friendRequest): bool
    {
        return $friendRequest->sender_id === $user->id;
    }
}
