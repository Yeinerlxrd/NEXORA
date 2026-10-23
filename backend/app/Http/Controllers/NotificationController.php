<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificationResource;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->paginate(20);
        $response = $notifications->toArray();
        $response['data'] = NotificationResource::collection($notifications->getCollection())->resolve($request);

        return response()->json($response);
    }

    public function unreadCount(Request $request)
    {
        return response()->json([
            'unread_count' => $request->user()
                ->notifications()
                ->whereNull('read_at')
                ->count(),
        ]);
    }

    public function markRead(Request $request, int $notification)
    {
        $record = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        if ($record->read_at === null) {
            $record->forceFill(['read_at' => now()])->save();
        }

        return response()->json([
            'message' => 'Notificación marcada como leída.',
            'notification' => NotificationResource::make($record->fresh())->resolve($request),
        ]);
    }

    public function markAllRead(Request $request)
    {
        $updated = $request->user()
            ->notifications()
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Notificaciones marcadas como leídas.',
            'updated_count' => $updated,
        ]);
    }
}
