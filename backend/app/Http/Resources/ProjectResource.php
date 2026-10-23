<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'group_id' => $this->group_id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'due_at' => $this->due_at?->format('Y-m-d'),
            'archived_at' => $this->archived_at,
            'creator_public_id' => $this->whenLoaded('creator', fn () => $this->creator?->public_id),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator?->only(['public_id', 'name', 'avatar_url', 'bio'])),
            'group' => $this->whenLoaded('group', fn () => $this->group?->only(['id', 'name'])),
            'tasks' => $this->whenLoaded('tasks', fn () => TaskResource::collection($this->tasks)->resolve($request)),
        ];
    }
}
