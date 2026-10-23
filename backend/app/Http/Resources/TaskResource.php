<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'due_at' => $this->due_at?->format('Y-m-d'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'project' => $this->whenLoaded('project', fn () => [
                'id' => $this->project->id,
                'name' => $this->project->name,
            ]),
            'creator' => $this->whenLoaded('creator', fn () => $this->projectUser($this->creator)),
            'assignee' => $this->whenLoaded('assignee', fn () => $this->projectUser($this->assignee)),
        ];
    }

    private function projectUser($user): ?array
    {
        return $user?->only(['public_id', 'name', 'avatar_url', 'bio']);
    }
}
