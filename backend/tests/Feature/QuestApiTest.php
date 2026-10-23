<?php

namespace Tests\Feature;

use App\Models\Quest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_read_or_create_quests(): void
    {
        $this->getJson('/api/quests')->assertUnauthorized();
        $this->postJson('/api/quests', ['title' => 'Reto protegido'])->assertUnauthorized();
    }

    public function test_user_can_create_join_and_complete_a_quest_once_without_exposing_creator_email(): void
    {
        $creator = User::factory()->create(['email' => 'private-quest-owner@nexora.test']);
        $participant = User::factory()->create(['email' => 'private-participant@nexora.test']);

        $created = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/quests', [
                'title' => 'Reto semanal',
                'description' => 'Completa una iniciativa del equipo.',
                'category' => 'Productividad',
                'difficulty' => 'Media',
                'due_at' => today()->addDays(3)->toDateString(),
                'reward_xp' => 120,
            ])
            ->assertCreated()
            ->assertJsonPath('quest.title', 'Reto semanal')
            ->assertJsonPath('quest.my_progress', null)
            ->assertJsonMissing(['email' => $creator->email]);

        $questId = $created->json('quest.id');
        $this->assertNotNull($questId);

        $this->postJson("/api/quests/{$questId}/join")->assertForbidden();

        $this->actingAs($participant, 'sanctum')
            ->getJson('/api/quests')
            ->assertOk()
            ->assertJsonPath('data.0.creator.public_id', $creator->public_id)
            ->assertJsonMissing(['email' => $creator->email]);

        $this->postJson("/api/quests/{$questId}/join")
            ->assertOk()
            ->assertJsonPath('progress', 0);

        $this->patchJson("/api/quests/{$questId}/progress", ['progress' => 60])
            ->assertOk()
            ->assertJsonPath('progress', 60)
            ->assertJsonPath('completed', false)
            ->assertJsonPath('xp_awarded', 0);

        $this->patchJson("/api/quests/{$questId}/progress", ['progress' => 100])
            ->assertOk()
            ->assertJsonPath('progress', 100)
            ->assertJsonPath('completed', true)
            ->assertJsonPath('xp_awarded', 120)
            ->assertJsonPath('xp_total', 120);

        $this->patchJson("/api/quests/{$questId}/progress", ['progress' => 100])
            ->assertStatus(409);

        $this->assertDatabaseHas('users', ['id' => $participant->id, 'xp_total' => 120]);
        $this->assertDatabaseHas('quest_participants', [
            'quest_id' => $questId,
            'user_id' => $participant->id,
            'progress' => 100,
            'completed' => true,
        ]);
    }

    public function test_nonparticipant_cannot_change_progress_and_due_quests_cannot_be_joined(): void
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();
        $quest = Quest::create([
            'title' => 'Reto privado al progreso',
            'category' => 'Productividad',
            'difficulty' => 'Media',
            'creator_id' => $owner->id,
            'due_at' => today()->addDay(),
            'reward_xp' => 50,
            'status' => 'active',
        ]);

        $this->actingAs($outsider, 'sanctum')
            ->patchJson("/api/quests/{$quest->id}/progress", ['progress' => 50])
            ->assertForbidden();

        $quest->update(['due_at' => today()->subDay()]);
        $this->postJson("/api/quests/{$quest->id}/join")
            ->assertStatus(409);
    }

    public function test_progress_must_be_an_integer_between_zero_and_one_hundred(): void
    {
        $user = User::factory()->create();
        $quest = Quest::create([
            'title' => 'Reto de validación',
            'creator_id' => $user->id,
            'reward_xp' => 25,
            'status' => 'active',
        ]);
        $quest->participants()->attach($user->id);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/quests/{$quest->id}/progress", ['progress' => 101])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['progress']);
    }
}
