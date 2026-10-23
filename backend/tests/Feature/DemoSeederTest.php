<?php

namespace Tests\Feature;

use App\Models\Quest;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_quest_has_an_eligible_participant_and_seeding_is_idempotent(): void
    {
        app(DemoSeeder::class)->run();
        app(DemoSeeder::class)->run();

        $creator = User::query()->where('email', 'demo@nexora.local')->firstOrFail();
        $participant = User::query()->where('email', 'alex@nexora.local')->firstOrFail();
        $quest = Quest::query()
            ->where('title', 'Reto de productividad semanal')
            ->where('creator_id', $creator->id)
            ->firstOrFail();

        $this->assertFalse($quest->participants()->whereKey($creator->id)->exists());
        $this->assertTrue($quest->participants()->whereKey($participant->id)->exists());
        $this->assertSame(60, $quest->participants()->whereKey($participant->id)->first()->pivot->progress);
        $this->assertDatabaseCount('users', 2);
        $this->assertDatabaseCount('quest_participants', 1);
    }
}
