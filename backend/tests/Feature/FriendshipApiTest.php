<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FriendshipApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_search_profiles_or_manage_friend_requests(): void
    {
        $otherUser = User::factory()->create();

        $this->getJson('/api/users?search=Ana')->assertUnauthorized();
        $this->getJson("/api/users/{$otherUser->public_id}")->assertUnauthorized();
        $this->postJson('/api/friend-requests', ['public_id' => $otherUser->public_id])->assertUnauthorized();
        $this->getJson('/api/friend-requests/received')->assertUnauthorized();
        $this->getJson('/api/friend-requests/sent')->assertUnauthorized();
        $this->getJson('/api/friends')->assertUnauthorized();
    }

    public function test_authenticated_user_can_search_people_by_name_and_public_id(): void
    {
        $user = User::factory()->create(['name' => 'Searching User']);
        $byName = User::factory()->create(['name' => 'Ana López']);
        $byId = User::factory()->create(['name' => 'Bruno Díaz']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/users?search=Ana')
            ->assertOk()
            ->assertJsonFragment(['public_id' => $byName->public_id, 'name' => 'Ana López'])
            ->assertJsonMissing(['public_id' => $byId->public_id]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/users?search={$byId->public_id}")
            ->assertOk()
            ->assertJsonFragment(['public_id' => $byId->public_id, 'name' => 'Bruno Díaz']);
    }

    public function test_public_profile_does_not_expose_email_or_private_account_fields(): void
    {
        $viewer = User::factory()->create();
        $profile = User::factory()->create([
            'name' => 'Public Profile',
            'email' => 'private-profile@nexora.test',
            'avatar_url' => 'https://example.test/avatar.png',
            'bio' => 'A public biography.',
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/users/{$profile->public_id}")
            ->assertOk()
            ->assertJsonFragment([
                'public_id' => $profile->public_id,
                'name' => 'Public Profile',
                'avatar_url' => 'https://example.test/avatar.png',
                'bio' => 'A public biography.',
            ])
            ->assertJsonMissingPath('email')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token');
    }

    public function test_user_can_send_a_request_and_see_it_in_sent_and_received_lists(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $request = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertCreated()
            ->assertJsonPath('status', 'pending');

        $requestId = $request->json('id');
        $this->assertNotNull($requestId);

        $this->actingAs($sender, 'sanctum')
            ->getJson('/api/friend-requests/sent')
            ->assertOk()
            ->assertJsonFragment(['id' => $requestId, 'status' => 'pending']);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friend-requests/received')
            ->assertOk()
            ->assertJsonFragment(['id' => $requestId, 'status' => 'pending']);
    }

    public function test_self_requests_and_duplicate_pending_requests_are_rejected_without_extra_notifications(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $sender->public_id])
            ->assertUnprocessable();

        $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertCreated();

        $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertStatus(409);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friend-requests/received')
            ->assertOk()
            ->assertJsonCount(1);

        $this->assertSame(
            1,
            Notification::where('user_id', $recipient->id)
                ->where('type', 'friend_request')
                ->count()
        );
    }

    public function test_reciprocal_pending_request_auto_accepts_and_creates_a_friendship(): void
    {
        $firstUser = User::factory()->create();
        $secondUser = User::factory()->create();

        $this->actingAs($firstUser, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $secondUser->public_id])
            ->assertCreated();

        $this->actingAs($secondUser, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $firstUser->public_id])
            ->assertOk();

        $this->actingAs($firstUser, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonFragment(['public_id' => $secondUser->public_id]);

        $this->actingAs($secondUser, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonFragment(['public_id' => $firstUser->public_id]);

        $this->actingAs($firstUser, 'sanctum')
            ->getJson('/api/friend-requests/received')
            ->assertOk()
            ->assertJsonCount(0);

        $this->actingAs($secondUser, 'sanctum')
            ->getJson('/api/friend-requests/sent')
            ->assertOk()
            ->assertJsonCount(0);

        $this->assertSame(
            1,
            Notification::where('user_id', $firstUser->id)
                ->where('type', 'friend_accepted')
                ->count()
        );
    }

    public function test_recipient_can_accept_a_request_and_sender_receives_a_persistent_notification(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $request = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertCreated();
        $requestId = $request->json('id');

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/accept")
            ->assertOk();

        $this->actingAs($sender, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonFragment(['public_id' => $recipient->public_id]);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonFragment(['public_id' => $sender->public_id]);

        $this->assertSame(
            1,
            Notification::where('user_id', $sender->id)
                ->where('type', 'friend_accepted')
                ->count()
        );
    }

    public function test_recipient_can_reject_a_request_without_creating_a_friendship(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $request = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertCreated();
        $requestId = $request->json('id');

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/reject")
            ->assertOk();

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/reject")
            ->assertStatus(409);

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/accept")
            ->assertStatus(409);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonMissing(['public_id' => $sender->public_id]);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friend-requests/received')
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_sender_can_cancel_a_pending_request(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();

        $request = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertCreated();
        $requestId = $request->json('id');

        $this->actingAs($sender, 'sanctum')
            ->deleteJson("/api/friend-requests/{$requestId}")
            ->assertOk();

        $this->actingAs($sender, 'sanctum')
            ->deleteJson("/api/friend-requests/{$requestId}")
            ->assertStatus(409);

        $this->actingAs($sender, 'sanctum')
            ->getJson('/api/friend-requests/sent')
            ->assertOk()
            ->assertJsonCount(0);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friend-requests/received')
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_user_can_remove_an_existing_friendship(): void
    {
        $firstUser = User::factory()->create();
        $secondUser = User::factory()->create();

        $request = $this->actingAs($firstUser, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $secondUser->public_id])
            ->assertCreated();
        $requestId = $request->json('id');

        $this->actingAs($secondUser, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/accept")
            ->assertOk();

        $this->actingAs($firstUser, 'sanctum')
            ->deleteJson("/api/friends/{$secondUser->public_id}")
            ->assertOk();

        $this->actingAs($firstUser, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonMissing(['public_id' => $secondUser->public_id]);

        $this->actingAs($secondUser, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonMissing(['public_id' => $firstUser->public_id]);
    }

    public function test_user_cannot_accept_reject_or_cancel_another_users_request(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $outsider = User::factory()->create();

        $request = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/friend-requests', ['public_id' => $recipient->public_id])
            ->assertCreated();
        $requestId = $request->json('id');

        $this->actingAs($outsider, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/accept")
            ->assertForbidden();

        $this->actingAs($outsider, 'sanctum')
            ->postJson("/api/friend-requests/{$requestId}/reject")
            ->assertForbidden();

        $this->actingAs($outsider, 'sanctum')
            ->deleteJson("/api/friend-requests/{$requestId}")
            ->assertForbidden();

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/friend-requests/received')
            ->assertOk()
            ->assertJsonFragment(['id' => $requestId, 'status' => 'pending']);

        $this->actingAs($outsider, 'sanctum')
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonCount(0);
    }
}
