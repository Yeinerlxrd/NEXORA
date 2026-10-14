<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectTaskAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_and_task_creation_and_member_isolation(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();

        $group = Group::create([
            'name' => 'Equipo de pruebas',
            'owner_id' => $owner->id,
        ]);

        $group->members()->attach($member->id, ['role' => 'Member']);

        $project = Project::create([
            'name' => 'Proyecto alpha',
            'description' => 'Proyecto privado',
            'creator_id' => $owner->id,
            'group_id' => $group->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);

        $task = Task::create([
            'title' => 'Diseñar flujo',
            'project_id' => $project->id,
            'creator_id' => $owner->id,
            'assignee_id' => $member->id,
            'status' => 'Pendiente',
            'priority' => 'Alta',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/projects')
            ->assertStatus(200);

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/tasks')
            ->assertStatus(200)
            ->assertJsonFragment(['title' => 'Diseñar flujo']);

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    public function test_user_cannot_assign_a_task_to_someone_outside_the_project(): void
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();
        $member = User::factory()->create();
        $group = Group::create([
            'name' => 'Equipo privado',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);

        $project = Project::create([
            'name' => 'Proyecto privado',
            'creator_id' => $owner->id,
            'group_id' => $group->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson('/api/tasks', [
                'title' => 'Tarea privada',
                'project_id' => $project->id,
                'assignee_id' => $outsider->id,
                'status' => 'Pendiente',
                'priority' => 'Media',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('tasks', [
            'title' => 'Tarea privada',
            'project_id' => $project->id,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson('/api/tasks', [
                'title' => 'Tarea de equipo',
                'project_id' => $project->id,
                'assignee_id' => $member->id,
                'status' => 'Pendiente',
                'priority' => 'Media',
            ])
            ->assertCreated();
    }
}
