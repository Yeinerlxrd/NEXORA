<?php

namespace App\Http\Controllers;

use App\Models\FriendRequest;
use App\Models\Friendship;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class FriendshipController extends Controller
{
    public function search(Request $request)
    {
        $data = $request->validate([
            'search' => ['required', 'string', 'min:2', 'max:80'],
        ]);
        $term = trim($data['search']);

        $users = User::query()
            ->select(['id', 'public_id', 'name', 'avatar_url', 'bio'])
            ->where('id', '<>', $request->user()->id)
            ->where(function ($query) use ($term): void {
                $query->where('name', 'like', "%{$term}%")
                    ->orWhere('public_id', $term);
            })
            ->orderBy('name')
            ->limit(20)
            ->get();

        return response()->json($users->map(fn (User $user): array => $this->publicUser($user)));
    }

    public function show(User $user)
    {
        return response()->json($this->publicUser($user));
    }

    public function friends(Request $request)
    {
        $userId = $request->user()->id;

        $friends = Friendship::query()
            ->where(fn ($query) => $query->where('user_one_id', $userId)->orWhere('user_two_id', $userId))
            ->with([
                'userOne:id,public_id,name,avatar_url,bio',
                'userTwo:id,public_id,name,avatar_url,bio',
            ])
            ->get()
            ->map(function (Friendship $friendship) use ($userId): array {
                $friend = $friendship->user_one_id === $userId
                    ? $friendship->userTwo
                    : $friendship->userOne;

                return $this->publicUser($friend);
            })
            ->values();

        return response()->json($friends);
    }

    public function sentRequests(Request $request)
    {
        return response()->json(
            $request->user()->sentFriendRequests()
                ->where('status', 'pending')
                ->with('recipient:id,public_id,name,avatar_url,bio')
                ->latest()
                ->get()
                ->map(fn (FriendRequest $friendRequest): array => $this->requestPayload($friendRequest, 'recipient'))
                ->values()
        );
    }

    public function receivedRequests(Request $request)
    {
        return response()->json(
            $request->user()->receivedFriendRequests()
                ->where('status', 'pending')
                ->with('sender:id,public_id,name,avatar_url,bio')
                ->latest()
                ->get()
                ->map(fn (FriendRequest $friendRequest): array => $this->requestPayload($friendRequest, 'sender'))
                ->values()
        );
    }

    public function sendRequest(Request $request)
    {
        $data = $request->validate([
            'public_id' => ['required', 'uuid', 'exists:users,public_id'],
        ]);
        $recipient = User::query()->where('public_id', $data['public_id'])->firstOrFail();
        $sender = $request->user();

        if ($recipient->is($sender)) {
            throw ValidationException::withMessages([
                'public_id' => ['No puedes enviarte una solicitud de amistad.'],
            ]);
        }

        $outcome = DB::transaction(function () use ($sender, $recipient): array {
            User::query()
                ->whereIn('id', [$sender->id, $recipient->id])
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if (Friendship::between($sender->id, $recipient->id)) {
                throw new ConflictHttpException('Ya existe una amistad con este usuario.');
            }

            $reciprocal = FriendRequest::query()
                ->where('sender_id', $recipient->id)
                ->where('recipient_id', $sender->id)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();

            if ($reciprocal) {
                $reciprocal->update(['status' => 'accepted']);
                $this->createFriendship($sender->id, $recipient->id);
                $this->notifyFriendAccepted($recipient->id, $sender);

                return ['request' => $reciprocal->fresh(), 'created' => false];
            }

            $friendRequest = FriendRequest::query()
                ->where('sender_id', $sender->id)
                ->where('recipient_id', $recipient->id)
                ->lockForUpdate()
                ->first();

            if ($friendRequest?->status === 'pending') {
                throw new ConflictHttpException('Ya hay una solicitud pendiente para este usuario.');
            }

            if ($friendRequest) {
                $friendRequest->update(['status' => 'pending']);
            } else {
                $friendRequest = FriendRequest::create([
                    'sender_id' => $sender->id,
                    'recipient_id' => $recipient->id,
                    'status' => 'pending',
                ]);
            }

            Notification::create([
                'user_id' => $recipient->id,
                'title' => 'Solicitud de amistad',
                'message' => "{$sender->name} quiere agregarte como amigo.",
                'type' => 'friend_request',
            ]);

            return ['request' => $friendRequest, 'created' => true];
        });

        return response()->json([
            'id' => $outcome['request']->id,
            'status' => $outcome['request']->status,
        ], $outcome['created'] ? 201 : 200);
    }

    public function acceptRequest(FriendRequest $friendRequest)
    {
        $this->authorize('respond', $friendRequest);

        DB::transaction(function () use ($friendRequest): void {
            User::query()
                ->whereIn('id', [$friendRequest->sender_id, $friendRequest->recipient_id])
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $lockedRequest = FriendRequest::query()->lockForUpdate()->findOrFail($friendRequest->id);
            if ($lockedRequest->status !== 'pending') {
                throw new ConflictHttpException('La solicitud ya no está pendiente.');
            }

            $lockedRequest->update(['status' => 'accepted']);
            FriendRequest::query()
                ->where('sender_id', $lockedRequest->recipient_id)
                ->where('recipient_id', $lockedRequest->sender_id)
                ->where('status', 'pending')
                ->update(['status' => 'accepted']);
            $this->createFriendship($lockedRequest->sender_id, $lockedRequest->recipient_id);

            $recipient = User::findOrFail($lockedRequest->recipient_id);
            $this->notifyFriendAccepted($lockedRequest->sender_id, $recipient);
        });

        return response()->json(['message' => 'Solicitud aceptada.']);
    }

    public function rejectRequest(FriendRequest $friendRequest)
    {
        $this->authorize('respond', $friendRequest);
        $this->transitionPendingRequest($friendRequest, 'rejected');

        return response()->json(['message' => 'Solicitud rechazada.']);
    }

    public function cancelRequest(FriendRequest $friendRequest)
    {
        $this->authorize('cancel', $friendRequest);
        $this->transitionPendingRequest($friendRequest, 'canceled');

        return response()->json(['message' => 'Solicitud cancelada.']);
    }

    public function removeFriend(Request $request, User $user)
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages([
                'user' => ['No puedes eliminarte de tu lista de amigos.'],
            ]);
        }

        $friendship = Friendship::between($request->user()->id, $user->id);
        if (! $friendship) {
            abort(404);
        }

        $friendship->delete();

        return response()->json(['message' => 'Amistad eliminada.']);
    }

    private function createFriendship(int $firstUserId, int $secondUserId): void
    {
        [$userOneId, $userTwoId] = Friendship::orderedPair($firstUserId, $secondUserId);

        Friendship::query()->firstOrCreate([
            'user_one_id' => $userOneId,
            'user_two_id' => $userTwoId,
        ]);
    }

    private function transitionPendingRequest(FriendRequest $friendRequest, string $status): void
    {
        DB::transaction(function () use ($friendRequest, $status): void {
            $lockedRequest = FriendRequest::query()->lockForUpdate()->findOrFail($friendRequest->id);
            if ($lockedRequest->status !== 'pending') {
                throw new ConflictHttpException('La solicitud ya no está pendiente.');
            }

            $lockedRequest->update(['status' => $status]);
        });
    }

    private function notifyFriendAccepted(int $userId, User $friend): void
    {
        Notification::create([
            'user_id' => $userId,
            'title' => 'Solicitud aceptada',
            'message' => "{$friend->name} aceptó tu solicitud de amistad.",
            'type' => 'friend_accepted',
        ]);
    }

    private function publicUser(User $user): array
    {
        return $user->only(['public_id', 'name', 'avatar_url', 'bio']);
    }

    private function requestPayload(FriendRequest $friendRequest, string $relatedUser): array
    {
        return [
            'id' => $friendRequest->id,
            'status' => $friendRequest->status,
            'created_at' => $friendRequest->created_at,
            'user' => $this->publicUser($friendRequest->{$relatedUser}),
        ];
    }
}
