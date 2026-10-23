<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GroupManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_and_admin_can_update_group_details(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $group = Group::create([
            'name' => 'Grupo inicial',
            'description' => 'Descripción anterior',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($admin->id, ['role' => 'Admin']);

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/groups/{$group->id}", [
                'name' => 'Grupo del propietario',
                'description' => 'Actualizado por el propietario',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Grupo del propietario')
            ->assertJsonPath('description', 'Actualizado por el propietario')
            ->assertJsonMissingPath('email');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/groups/{$group->id}", ['name' => 'Grupo del administrador'])
            ->assertOk()
            ->assertJsonPath('name', 'Grupo del administrador');

        $this->assertDatabaseHas('groups', [
            'id' => $group->id,
            'name' => 'Grupo del administrador',
            'description' => 'Actualizado por el propietario',
        ]);
    }

    public function test_regular_member_and_outsider_cannot_update_group_details(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $outsider = User::factory()->create();
        $group = Group::create(['name' => 'Grupo protegido', 'owner_id' => $owner->id]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);

        foreach ([$member, $outsider] as $unauthorizedUser) {
            $this->actingAs($unauthorizedUser, 'sanctum')
                ->putJson("/api/groups/{$group->id}", ['name' => 'Nombre no autorizado'])
                ->assertForbidden();
        }

        $this->assertDatabaseHas('groups', [
            'id' => $group->id,
            'name' => 'Grupo protegido',
        ]);
    }
}
