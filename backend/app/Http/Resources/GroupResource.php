<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'members_count' => $this->whenCounted('members'),
            'owner_public_id' => $this->whenLoaded('owner', fn () => $this->owner?->public_id),
            'owner' => $this->whenLoaded('owner', fn () => $this->owner?->only(['public_id', 'name', 'avatar_url', 'bio'])),
            'members' => $this->whenLoaded('members', fn () => $this->members->map(fn ($member): array => [
                ...$member->only(['public_id', 'name', 'avatar_url', 'bio']),
                'role' => $member->pivot->role,
            ])->values()),
            'projects' => $this->whenLoaded('projects', fn () => $this->projects->map(fn ($project): array => [
                'id' => $project->id,
                'name' => $project->name,
                'description' => $project->description,
                'status' => $project->status,
                'priority' => $project->priority,
                'due_at' => $project->due_at?->format('Y-m-d'),
                'archived_at' => $project->archived_at,
            ])->values()),
        ];
    }
}
