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

    public function test_project_archive_and_restore_preserve_tasks_and_hide_archived_data_from_active_lists(): void
    {
        $owner = User::factory()->create();
        $project = Project::create([
            'name' => 'Proyecto reversible',
            'creator_id' => $owner->id,
            'status' => 'En progreso',
            'priority' => 'Media',
        ]);
        $task = Task::create([
            'title' => 'Tarea que debe conservarse',
            'project_id' => $project->id,
            'creator_id' => $owner->id,
            'status' => 'Pendiente',
            'priority' => 'Media',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/projects/{$project->id}/archive")
            ->assertOk()
            ->assertJsonPath('project.id', $project->id);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/projects/{$project->id}/archive")
            ->assertStatus(409);

        $this->assertDatabaseHas('projects', ['id' => $project->id]);
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'project_id' => $project->id]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/projects')
            ->assertOk()
            ->assertJsonMissing(['id' => $project->id]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/projects/archived')
            ->assertOk()
            ->assertJsonFragment(['id' => $project->id]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonMissing(['id' => $task->id]);

        $outsider = User::factory()->create();
        $this->actingAs($outsider, 'sanctum')
            ->getJson('/api/projects/archived')
            ->assertOk()
            ->assertJsonMissing(['id' => $project->id]);

        $this->actingAs($owner, 'sanctum')
            ->postJson('/api/tasks', [
                'title' => 'Nueva tarea bloqueada',
                'project_id' => $project->id,
                'status' => 'Pendiente',
                'priority' => 'Media',
            ])
            ->assertStatus(409);

        $this->assertDatabaseMissing('tasks', ['title' => 'Nueva tarea bloqueada']);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/projects/{$project->id}/restore")
            ->assertOk();

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/projects/{$project->id}/restore")
            ->assertStatus(409);

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'archived_at' => null]);
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/projects')
            ->assertOk()
            ->assertJsonFragment(['id' => $project->id]);
    }

    public function test_project_archive_and_restore_require_owner_permission(): void
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();
        $project = Project::create([
            'name' => 'Proyecto privado',
            'creator_id' => $owner->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);

        $this->actingAs($outsider, 'sanctum')
            ->postJson("/api/projects/{$project->id}/archive")
            ->assertForbidden();

        $this->actingAs($outsider, 'sanctum')
            ->postJson("/api/projects/{$project->id}/restore")
            ->assertForbidden();

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'archived_at' => null]);
    }

    public function test_project_delete_is_rejected_without_deleting_project_or_tasks(): void
    {
        $owner = User::factory()->create();
        $project = Project::create([
            'name' => 'Proyecto protegido',
            'creator_id' => $owner->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);
        $task = Task::create([
            'title' => 'Tarea protegida',
            'project_id' => $project->id,
            'creator_id' => $owner->id,
            'status' => 'Pendiente',
            'priority' => 'Media',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/projects/{$project->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('projects', ['id' => $project->id]);
        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }
}
