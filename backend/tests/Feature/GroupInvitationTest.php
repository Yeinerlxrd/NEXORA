<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Integration coverage for group invitations and membership operations. */
class GroupInvitationTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_friend_cannot_be_invited_to_a_group(): void
    {
        [$owner, $group] = $this->createGroupWithOwner();
        $nonFriend = User::factory()->create();

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/groups/{$group->id}/invitations", [
                'invitee_public_id' => $nonFriend->public_id,
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('group_invitations', [
            'group_id' => $group->id,
            'invitee_id' => $nonFriend->id,
            'status' => 'pending',
        ]);
    }

    public function test_group_owner_and_admin_reach_the_duplicate_invitation_guard(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $invitee = User::factory()->create();
        $group = Group::create([
            'name' => 'Invitation permissions',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($admin->id, ['role' => 'Admin']);
        $this->makeFriends($owner, $invitee);
        $this->makeFriends($admin, $invitee);
        $this->createPendingInvitation($group, $owner, $invitee);

        foreach ([$owner, $admin] as $inviter) {
            $this->actingAs($inviter, 'sanctum')
                ->postJson("/api/groups/{$group->id}/invitations", [
                    'invitee_public_id' => $invitee->public_id,
                ])
                ->assertStatus(409);
        }

        $this->assertDatabaseCount('group_invitations', 1);
    }

    public function test_regular_group_member_cannot_invite_or_duplicate_an_invitation(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $invitee = User::factory()->create();
        $group = Group::create([
            'name' => 'Member permissions',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);
        $this->createPendingInvitation($group, $owner, $invitee);

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/groups/{$group->id}/invitations", [
                'invitee_public_id' => $invitee->public_id,
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('group_invitations', 1);
    }

    public function test_received_invitations_are_limited_to_the_signed_in_invitee(): void
    {
        $owner = User::factory()->create();
        $invitee = User::factory()->create();
        $otherInvitee = User::factory()->create();
        $group = Group::create([
            'name' => 'Received invitations',
            'owner_id' => $owner->id,
        ]);
        $mine = $this->createPendingInvitation($group, $owner, $invitee);
        $theirs = $this->createPendingInvitation($group, $owner, $otherInvitee);

        $response = $this->actingAs($invitee, 'sanctum')
            ->getJson('/api/group-invitations/received')
            ->assertOk()
            ->assertJsonFragment(['id' => $mine->id]);

        $this->assertFalse(collect($response->json())->contains('id', $theirs->id));
    }

    public function test_invitee_can_accept_and_joins_the_group_as_a_member(): void
    {
        [$owner, $group] = $this->createGroupWithOwner();
        $invitee = User::factory()->create();
        $invitation = $this->createPendingInvitation($group, $owner, $invitee);

        $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/group-invitations/{$invitation->id}/accept")
            ->assertSuccessful();

        $this->assertDatabaseHas('group_invitations', [
            'id' => $invitation->id,
            'status' => 'accepted',
        ]);
        $this->assertNotNull($invitation->fresh()->accepted_at);
        $this->assertDatabaseHas('group_members', [
            'group_id' => $group->id,
            'user_id' => $invitee->id,
            'role' => 'Member',
        ]);
        $this->assertDatabaseCount('group_members', 2);
    }

    public function test_invitee_can_reject_without_becoming_a_group_member(): void
    {
        [$owner, $group] = $this->createGroupWithOwner();
        $invitee = User::factory()->create();
        $invitation = $this->createPendingInvitation($group, $owner, $invitee);

        $this->actingAs($invitee, 'sanctum')
            ->postJson("/api/group-invitations/{$invitation->id}/reject")
            ->assertSuccessful();

        $this->assertDatabaseHas('group_invitations', [
            'id' => $invitation->id,
            'status' => 'rejected',
        ]);
        $this->assertDatabaseMissing('group_members', [
            'group_id' => $group->id,
            'user_id' => $invitee->id,
        ]);
    }

    public function test_only_the_invitee_can_respond_to_an_invitation(): void
    {
        [$owner, $group] = $this->createGroupWithOwner();
        $invitee = User::factory()->create();
        $outsider = User::factory()->create();
        $invitation = $this->createPendingInvitation($group, $owner, $invitee);

        $this->actingAs($outsider, 'sanctum')
            ->postJson("/api/group-invitations/{$invitation->id}/accept")
            ->assertForbidden();

        $this->assertDatabaseHas('group_invitations', [
            'id' => $invitation->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseMissing('group_members', [
            'group_id' => $group->id,
            'user_id' => $invitee->id,
        ]);
    }

    public function test_group_members_can_list_members_but_nonmembers_cannot(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $outsider = User::factory()->create();
        $group = Group::create([
            'name' => 'Member list access',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);

        $this->actingAs($member, 'sanctum')
            ->getJson("/api/groups/{$group->id}/members")
            ->assertOk()
            ->assertJsonFragment(['public_id' => $owner->public_id])
            ->assertJsonFragment(['public_id' => $member->public_id])
            ->assertJsonMissingPath('email');

        $this->actingAs($outsider, 'sanctum')
            ->getJson("/api/groups/{$group->id}/members")
            ->assertForbidden();
    }

    public function test_group_member_can_leave_and_membership_is_removed(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $group = Group::create([
            'name' => 'Member departure',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($member->id, ['role' => 'Member']);

        $this->actingAs($member, 'sanctum')
            ->deleteJson("/api/groups/{$group->id}/membership")
            ->assertSuccessful();

        $this->assertDatabaseMissing('group_members', [
            'group_id' => $group->id,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('group_members', [
            'group_id' => $group->id,
            'user_id' => $owner->id,
        ]);
    }

    public function test_last_owner_cannot_leave_the_group(): void
    {
        [$owner, $group] = $this->createGroupWithOwner();

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/groups/{$group->id}/membership")
            ->assertStatus(409);

        $this->assertDatabaseHas('group_members', [
            'group_id' => $group->id,
            'user_id' => $owner->id,
            'role' => 'Owner',
        ]);
    }

    public function test_duplicate_pending_invitation_is_not_created(): void
    {
        [$owner, $group] = $this->createGroupWithOwner();
        $invitee = User::factory()->create();
        $this->makeFriends($owner, $invitee);
        $this->createPendingInvitation($group, $owner, $invitee);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/groups/{$group->id}/invitations", [
                'invitee_public_id' => $invitee->public_id,
            ])
            ->assertStatus(409);

        $this->assertDatabaseCount('group_invitations', 1);
        $this->assertDatabaseHas('group_invitations', [
            'group_id' => $group->id,
            'invitee_id' => $invitee->id,
            'status' => 'pending',
        ]);
    }

    public function test_pending_invitation_list_and_cancelation_respect_group_permissions(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create();
        $member = User::factory()->create();
        $invitee = User::factory()->create(['email' => 'invitee-private@nexora.test']);
        $group = Group::create(['name' => 'Invitation management', 'owner_id' => $owner->id]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);
        $group->members()->attach($admin->id, ['role' => 'Admin']);
        $group->members()->attach($member->id, ['role' => 'Member']);
        $invitation = $this->createPendingInvitation($group, $admin, $invitee);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/groups/{$group->id}/invitations")
            ->assertOk()
            ->assertJsonPath('0.invitee.public_id', $invitee->public_id)
            ->assertJsonMissing(['email' => $invitee->email]);

        $this->actingAs($member, 'sanctum')
            ->getJson("/api/groups/{$group->id}/invitations")
            ->assertForbidden();
        $this->deleteJson("/api/group-invitations/{$invitation->id}")->assertForbidden();
        $this->assertDatabaseHas('group_invitations', ['id' => $invitation->id, 'status' => 'pending']);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/group-invitations/{$invitation->id}")
            ->assertOk();
        $this->assertDatabaseHas('group_invitations', ['id' => $invitation->id, 'status' => 'canceled']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $invitee->id,
            'type' => 'group_invitation_canceled',
        ]);
        $this->deleteJson("/api/group-invitations/{$invitation->id}")->assertStatus(409);
    }

    /**
     * @return array{0: User, 1: Group}
     */
    private function createGroupWithOwner(): array
    {
        $owner = User::factory()->create();
        $group = Group::create([
            'name' => 'Test group',
            'owner_id' => $owner->id,
        ]);
        $group->members()->attach($owner->id, ['role' => 'Owner']);

        return [$owner, $group];
    }

    private function createPendingInvitation(
        Group $group,
        User $inviter,
        User $invitee
    ): GroupInvitation {
        return GroupInvitation::create([
            'group_id' => $group->id,
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'token_hash' => hash('sha256', "{$group->id}:{$inviter->id}:{$invitee->id}"),
            'expires_at' => null,
            'accepted_at' => null,
            'status' => 'pending',
        ]);
    }

    private function makeFriends(User $firstUser, User $secondUser): void
    {
        [$userOneId, $userTwoId] = Friendship::orderedPair($firstUser->id, $secondUser->id);
        Friendship::create([
            'user_one_id' => $userOneId,
            'user_two_id' => $userTwoId,
        ]);
    }
}
