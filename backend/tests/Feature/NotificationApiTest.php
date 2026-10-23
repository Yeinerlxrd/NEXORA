<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_notification_routes_require_authentication(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();
        $this->getJson('/api/notifications/unread-count')->assertUnauthorized();
    }

    public function test_user_only_receives_their_notifications_and_unread_count(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $unread = Notification::create([
            'user_id' => $user->id,
            'title' => 'Solicitud recibida',
            'message' => 'Una persona envió una solicitud.',
            'type' => 'friend_request',
        ]);
        Notification::create([
            'user_id' => $user->id,
            'title' => 'Ya son amigos',
            'message' => 'La solicitud fue aceptada.',
            'type' => 'friend_accepted',
            'read_at' => now(),
        ]);
        Notification::create([
            'user_id' => $otherUser->id,
            'title' => 'Privada',
            'message' => 'No debe aparecer en la cuenta ajena.',
            'type' => 'info',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('per_page', 20)
            ->assertJsonPath('total', 2)
            ->assertJsonFragment(['id' => $unread->id])
            ->assertJsonMissingPath('data.0.user_id')
            ->assertJsonMissing(['title' => 'Privada']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);
    }

    public function test_user_can_mark_their_notification_as_read(): void
    {
        $user = User::factory()->create();
        $notification = Notification::create([
            'user_id' => $user->id,
            'title' => 'Invitación recibida',
            'message' => 'Te invitaron a un grupo.',
            'type' => 'group_invitation',
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertOk()
            ->assertJsonMissingPath('notification.user_id');

        $this->assertDatabaseMissing('notifications', [
            'id' => $notification->id,
            'read_at' => null,
        ]);
    }

    public function test_user_cannot_mark_another_users_notification_as_read(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $notification = Notification::create([
            'user_id' => $owner->id,
            'title' => 'Privada',
            'message' => 'Notificación privada.',
            'type' => 'info',
        ]);

        $this->actingAs($otherUser, 'sanctum')
            ->patchJson("/api/notifications/{$notification->id}/read")
            ->assertNotFound();

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'read_at' => null,
        ]);
    }

    public function test_user_can_mark_all_their_notifications_as_read(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        foreach (['Primera', 'Segunda'] as $title) {
            Notification::create([
                'user_id' => $user->id,
                'title' => $title,
                'message' => 'Notificación pendiente.',
                'type' => 'info',
            ]);
        }
        $otherNotification = Notification::create([
            'user_id' => $otherUser->id,
            'title' => 'Privada',
            'message' => 'Debe seguir sin leerse.',
            'type' => 'info',
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/notifications/read-all')
            ->assertOk();

        $this->assertSame(0, Notification::where('user_id', $user->id)->whereNull('read_at')->count());
        $this->assertDatabaseHas('notifications', [
            'id' => $otherNotification->id,
            'read_at' => null,
        ]);
    }
}
