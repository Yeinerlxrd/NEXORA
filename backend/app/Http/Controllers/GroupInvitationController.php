<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class GroupInvitationController extends Controller
{
    public function store(Request $request, Group $group)
    {
        $this->authorize('invite', $group);
        $data = $request->validate([
            'invitee_public_id' => ['required', 'uuid', 'exists:users,public_id'],
        ]);
        $invitee = User::query()->where('public_id', $data['invitee_public_id'])->firstOrFail();
        $inviter = $request->user();

        if ($invitee->is($inviter)) {
            abort(422, 'No puedes invitarte a tu propio grupo.');
        }

        $invitation = DB::transaction(function () use ($group, $inviter, $invitee): GroupInvitation {
            $lockedGroup = Group::query()->lockForUpdate()->findOrFail($group->id);

            if ($lockedGroup->members()->where('users.id', $invitee->id)->exists()) {
                throw new ConflictHttpException('La persona ya pertenece al grupo.');
            }

            if (! Friendship::between($inviter->id, $invitee->id)) {
                abort(403, 'Solo puedes invitar a una persona que sea tu amiga.');
            }

            GroupInvitation::query()
                ->where('group_id', $lockedGroup->id)
                ->where('invitee_id', $invitee->id)
                ->where('status', 'pending')
                ->whereNotNull('expires_at')
                ->where('expires_at', '<=', now())
                ->update(['status' => 'expired']);

            $pendingExists = GroupInvitation::query()
                ->where('group_id', $lockedGroup->id)
                ->where('invitee_id', $invitee->id)
                ->where('status', 'pending')
                ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->exists();

            if ($pendingExists) {
                throw new ConflictHttpException('Ya hay una invitación pendiente para esta persona.');
            }

            $invitation = GroupInvitation::create([
                'group_id' => $lockedGroup->id,
                'inviter_id' => $inviter->id,
                'invitee_id' => $invitee->id,
                'token_hash' => hash('sha256', Str::random(64)),
                'expires_at' => now()->addDays(7),
                'status' => 'pending',
            ]);

            Notification::create([
                'user_id' => $invitee->id,
                'title' => 'Invitación a un grupo',
                'message' => "{$inviter->name} te invitó a {$lockedGroup->name}.",
                'type' => 'group_invitation',
            ]);

            return $invitation;
        });

        return response()->json([
            'id' => $invitation->id,
            'status' => $invitation->status,
            'expires_at' => $invitation->expires_at,
        ], 201);
    }

    public function received(Request $request)
    {
        $invitations = GroupInvitation::query()
            ->where('invitee_id', $request->user()->id)
            ->where('status', 'pending')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->with([
                'group:id,name,description',
                'inviter:id,public_id,name,avatar_url',
            ])
            ->latest()
            ->get()
            ->map(fn (GroupInvitation $invitation): array => [
                'id' => $invitation->id,
                'status' => $invitation->status,
                'expires_at' => $invitation->expires_at,
                'group' => $invitation->group->only(['id', 'name', 'description']),
                'inviter' => $invitation->inviter->only(['public_id', 'name', 'avatar_url']),
            ])
            ->values();

        return response()->json($invitations);
    }

    public function sent(Request $request, Group $group)
    {
        $this->authorize('invite', $group);

        $invitations = GroupInvitation::query()
            ->where('group_id', $group->id)
            ->where('status', 'pending')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->with('invitee:id,public_id,name,avatar_url')
            ->latest()
            ->get()
            ->map(fn (GroupInvitation $invitation): array => [
                'id' => $invitation->id,
                'status' => $invitation->status,
                'expires_at' => $invitation->expires_at,
                'invitee' => $invitation->invitee->only(['public_id', 'name', 'avatar_url']),
            ])
            ->values();

        return response()->json($invitations);
    }

    public function cancel(Request $request, GroupInvitation $invitation)
    {
        $group = $invitation->group;
        abort_unless(
            $invitation->inviter_id === $request->user()->id || $request->user()->can('invite', $group),
            403,
        );

        DB::transaction(function () use ($invitation): void {
            $lockedInvitation = GroupInvitation::query()->lockForUpdate()->findOrFail($invitation->id);
            if ($lockedInvitation->status !== 'pending') {
                throw new ConflictHttpException('La invitación ya no está pendiente.');
            }

            if ($lockedInvitation->expires_at && $lockedInvitation->expires_at->isPast()) {
                throw new ConflictHttpException('La invitación venció y ya no se puede cancelar.');
            }

            $lockedInvitation->update(['status' => 'canceled']);
            Notification::create([
                'user_id' => $lockedInvitation->invitee_id,
                'title' => 'Invitación cancelada',
                'message' => "La invitación al grupo {$lockedInvitation->group->name} fue cancelada.",
                'type' => 'group_invitation_canceled',
            ]);
        });

        return response()->json(['message' => 'Invitación cancelada.']);
    }

    public function accept(Request $request, GroupInvitation $invitation)
    {
        return $this->respond($request, $invitation, true);
    }

    public function reject(Request $request, GroupInvitation $invitation)
    {
        return $this->respond($request, $invitation, false);
    }

    private function respond(Request $request, GroupInvitation $invitation, bool $accept)
    {
        abort_unless($invitation->invitee_id === $request->user()->id, 403);

        $expired = DB::transaction(function () use ($invitation, $request, $accept): bool {
            $lockedInvitation = GroupInvitation::query()
                ->lockForUpdate()
                ->findOrFail($invitation->id);

            if ($lockedInvitation->status !== 'pending') {
                throw new ConflictHttpException('La invitación ya fue respondida.');
            }

            if ($lockedInvitation->expires_at && $lockedInvitation->expires_at->isPast()) {
                $lockedInvitation->update(['status' => 'expired']);

                return true;
            }

            if ($accept) {
                $group = Group::query()->lockForUpdate()->findOrFail($lockedInvitation->group_id);
                if ($group->members()->where('users.id', $request->user()->id)->exists()) {
                    throw new ConflictHttpException('Ya perteneces a este grupo.');
                }

                $group->members()->attach($request->user()->id, ['role' => 'Member']);
                $lockedInvitation->update([
                    'status' => 'accepted',
                    'accepted_at' => now(),
                ]);
                $message = "{$request->user()->name} aceptó la invitación a {$group->name}.";
                $type = 'group_invitation_accepted';
            } else {
                $lockedInvitation->update(['status' => 'rejected']);
                $group = $lockedInvitation->group;
                $message = "{$request->user()->name} rechazó la invitación a {$group->name}.";
                $type = 'group_invitation_rejected';
            }

            Notification::create([
                'user_id' => $lockedInvitation->inviter_id,
                'title' => $accept ? 'Invitación aceptada' : 'Invitación rechazada',
                'message' => $message,
                'type' => $type,
            ]);

            return false;
        });

        if ($expired) {
            abort(410, 'La invitación venció.');
        }

        return response()->json([
            'message' => $accept ? 'Invitación aceptada.' : 'Invitación rechazada.',
        ]);
    }
}
