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

    public function test_group_project_and_task_responses_expose_public_user_fields_and_keep_access_policies(): void
    {
        $owner = User::factory()->create(['email' => 'owner-private@nexora.test']);
        $member = User::factory()->create(['email' => 'member-private@nexora.test']);
        $outsider = User::factory()->create(['email' => 'outsider-private@nexora.test']);
        $group = Group::create(['name' => 'Private group', 'owner_id' => $owner->id]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);
        $project = Project::create([
            'name' => 'Shared project',
            'creator_id' => $owner->id,
            'group_id' => $group->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);
        $task = Task::create([
            'title' => 'Shared task',
            'project_id' => $project->id,
            'creator_id' => $owner->id,
            'assignee_id' => $member->id,
            'status' => 'Pendiente',
            'priority' => 'Media',
        ]);

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/groups', ['name' => 'Created private group'])
            ->assertCreated()
            ->assertJsonPath('owner_public_id', $member->public_id)
            ->assertJsonMissingPath('owner_id')
            ->assertJsonMissing(['email' => $member->email]);

        $this->getJson('/api/groups')
            ->assertOk()
            ->assertJsonFragment(['id' => $group->id, 'owner_public_id' => $owner->public_id])
            ->assertJsonMissingPath('owner_id')
            ->assertJsonMissing(['email' => $owner->email]);

        $this->getJson("/api/groups/{$group->id}")
            ->assertOk()
            ->assertJsonPath('owner.public_id', $owner->public_id)
            ->assertJsonMissingPath('owner_id')
            ->assertJsonFragment(['public_id' => $owner->public_id, 'name' => $owner->name])
            ->assertJsonFragment(['public_id' => $member->public_id, 'name' => $member->name])
            ->assertJsonMissing(['email' => $owner->email])
            ->assertJsonMissing(['email' => $member->email]);

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonFragment(['id' => $project->id, 'name' => 'Shared project'])
            ->assertJsonPath('0.creator_public_id', $owner->public_id)
            ->assertJsonMissingPath('0.creator_id')
            ->assertJsonMissing(['email' => $owner->email]);

        $this->getJson("/api/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('creator.public_id', $owner->public_id)
            ->assertJsonPath('tasks.0.assignee.public_id', $member->public_id)
            ->assertJsonMissingPath('creator_id')
            ->assertJsonMissingPath('tasks.0.creator_id')
            ->assertJsonMissingPath('tasks.0.assignee_id')
            ->assertJsonMissing(['email' => $owner->email])
            ->assertJsonMissing(['email' => $member->email]);

        $this->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonFragment(['id' => $task->id, 'title' => 'Shared task'])
            ->assertJsonMissingPath('creator_id')
            ->assertJsonMissingPath('assignee_id')
            ->assertJsonMissing(['email' => $owner->email])
            ->assertJsonMissing(['email' => $member->email]);

        $this->getJson("/api/tasks/{$task->id}")
            ->assertOk()
            ->assertJsonPath('creator.public_id', $owner->public_id)
            ->assertJsonPath('assignee.public_id', $member->public_id)
            ->assertJsonMissingPath('creator_id')
            ->assertJsonMissingPath('assignee_id')
            ->assertJsonMissing(['email' => $owner->email])
            ->assertJsonMissing(['email' => $member->email]);

        $this->actingAs($outsider, 'sanctum')
            ->getJson("/api/groups/{$group->id}")
            ->assertForbidden();
        $this->getJson("/api/projects/{$project->id}")->assertForbidden();
        $this->getJson("/api/tasks/{$task->id}")->assertForbidden();
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

    public function test_task_assignment_accepts_public_ids_and_rejects_users_outside_the_project(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $outsider = User::factory()->create();
        $group = Group::create(['name' => 'Equipo público', 'owner_id' => $owner->id]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);
        $project = Project::create([
            'name' => 'Proyecto compartido',
            'creator_id' => $owner->id,
            'group_id' => $group->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);

        $created = $this->actingAs($owner, 'sanctum')
            ->postJson('/api/tasks', [
                'title' => 'Asignación pública',
                'project_id' => $project->id,
                'assignee_public_id' => $member->public_id,
                'status' => 'Pendiente',
                'priority' => 'Media',
            ])
            ->assertCreated()
            ->assertJsonPath('assignee.public_id', $member->public_id)
            ->assertJsonMissingPath('assignee_id')
            ->assertJsonMissingPath('creator_id');

        $taskId = $created->json('id');
        $this->putJson("/api/tasks/{$taskId}", ['assignee_public_id' => null])
            ->assertOk()
            ->assertJsonPath('assignee', null)
            ->assertJsonMissingPath('assignee_id');

        $this->postJson('/api/tasks', [
            'title' => 'Asignación ajena',
            'project_id' => $project->id,
            'assignee_public_id' => $outsider->public_id,
            'status' => 'Pendiente',
            'priority' => 'Media',
        ])->assertForbidden();
    }

    public function test_project_can_be_linked_to_a_group_only_by_a_member_and_editor(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $outsider = User::factory()->create();
        $group = Group::create(['name' => 'Grupo válido', 'owner_id' => $owner->id]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $project = Project::create([
            'name' => 'Proyecto propio',
            'creator_id' => $owner->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/projects/{$project->id}", ['group_id' => $group->id, 'name' => 'Proyecto vinculado'])
            ->assertOk()
            ->assertJsonPath('group_id', $group->id)
            ->assertJsonPath('name', 'Proyecto vinculado');

        $this->putJson("/api/projects/{$project->id}", ['group_id' => null])
            ->assertOk()
            ->assertJsonPath('group_id', null);

        $anotherGroup = Group::create(['name' => 'Grupo ajeno', 'owner_id' => $outsider->id]);
        $this->putJson("/api/projects/{$project->id}", ['group_id' => $anotherGroup->id, 'name' => 'No debe cambiar'])
            ->assertForbidden();
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'name' => 'Proyecto vinculado', 'group_id' => null]);

        $this->actingAs($member, 'sanctum')
            ->putJson("/api/projects/{$project->id}", ['name' => 'No autorizado'])
            ->assertForbidden();
    }

    public function test_task_edit_and_delete_policies_are_enforced(): void
    {
        $creator = User::factory()->create();
        $assignee = User::factory()->create();
        $outsider = User::factory()->create();
        $project = Project::create([
            'name' => 'Proyecto privado',
            'creator_id' => $creator->id,
            'status' => 'Planificación',
            'priority' => 'Media',
        ]);
        $task = Task::create([
            'title' => 'Tarea protegida',
            'project_id' => $project->id,
            'creator_id' => $creator->id,
            'assignee_id' => $assignee->id,
            'status' => 'Pendiente',
            'priority' => 'Media',
        ]);

        $this->actingAs($outsider, 'sanctum')
            ->putJson("/api/tasks/{$task->id}", ['title' => 'Intrusión'])
            ->assertForbidden();
        $this->deleteJson("/api/tasks/{$task->id}")->assertForbidden();
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'Tarea protegida']);

        $this->actingAs($assignee, 'sanctum')
            ->putJson("/api/tasks/{$task->id}", ['status' => 'En progreso'])
            ->assertOk();
        $this->deleteJson("/api/tasks/{$task->id}")->assertForbidden();

        $this->actingAs($creator, 'sanctum')
            ->deleteJson("/api/tasks/{$task->id}")
            ->assertOk();
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    public function test_moving_a_task_checks_destination_access_and_keeps_assignee_eligible(): void
    {
        $owner = User::factory()->create();
        $assignee = User::factory()->create();
        $sourceGroup = Group::create(['name' => 'Grupo de origen', 'owner_id' => $owner->id]);
        $targetGroup = Group::create(['name' => 'Grupo de destino', 'owner_id' => $owner->id]);
        $sourceGroup->members()->attach($owner->id, ['role' => 'Owner']);
        $sourceGroup->members()->attach($assignee->id, ['role' => 'Member']);
        $targetGroup->members()->attach($owner->id, ['role' => 'Owner']);
        $sourceProject = Project::create([
            'name' => 'Origen', 'creator_id' => $owner->id, 'group_id' => $sourceGroup->id,
            'status' => 'En progreso', 'priority' => 'Media',
        ]);
        $targetProject = Project::create([
            'name' => 'Destino', 'creator_id' => $owner->id, 'group_id' => $targetGroup->id,
            'status' => 'Planificación', 'priority' => 'Media',
        ]);
        $task = Task::create([
            'title' => 'Mover tarea', 'project_id' => $sourceProject->id,
            'creator_id' => $owner->id, 'assignee_id' => $assignee->id,
            'status' => 'Pendiente', 'priority' => 'Media',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/tasks/{$task->id}", ['project_id' => $targetProject->id])
            ->assertForbidden();
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'project_id' => $sourceProject->id]);

        $this->putJson("/api/tasks/{$task->id}", [
            'project_id' => $targetProject->id,
            'assignee_public_id' => null,
        ])->assertOk()->assertJsonPath('project_id', $targetProject->id);

        $archivedTarget = Project::create([
            'name' => 'Archivado', 'creator_id' => $owner->id, 'group_id' => $targetGroup->id,
            'status' => 'En progreso', 'priority' => 'Media', 'archived_at' => now(),
        ]);
        $this->putJson("/api/tasks/{$task->id}", ['project_id' => $archivedTarget->id])
            ->assertStatus(409);
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
