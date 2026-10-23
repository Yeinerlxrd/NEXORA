<?php

namespace App\Http\Controllers;

use App\Models\Quest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class QuestController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $quests = Quest::query()
            ->where('status', 'active')
            ->where(function ($query) use ($userId): void {
                $query->whereNull('due_at')
                    ->orWhereDate('due_at', '>=', today()->toDateString())
                    ->orWhereHas('participants', fn ($participants) => $participants->where('users.id', $userId));
            })
            ->with('creator:id,public_id,name,avatar_url')
            ->withCount('participants')
            ->with(['participants' => fn ($query) => $query->whereKey($userId)->select('users.id')])
            ->orderByRaw('due_at IS NULL')
            ->orderBy('due_at')
            ->latest()
            ->paginate(20);

        $quests->getCollection()->transform(fn (Quest $quest): array => $this->payload($quest));

        return response()->json($quests);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['required', 'string', 'max:60'],
            'difficulty' => ['required', 'in:Fácil,Media,Difícil'],
            'due_at' => ['nullable', 'date', 'after_or_equal:today'],
            'reward_xp' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);

        $quest = Quest::create([
            ...$data,
            'creator_id' => $request->user()->id,
            'status' => 'active',
        ]);

        return response()->json([
            'quest' => $this->loadForUser($quest->id, $request->user()->id),
        ], 201);
    }

    public function join(Request $request, Quest $quest)
    {
        DB::transaction(function () use ($request, $quest): void {
            $lockedQuest = Quest::query()->lockForUpdate()->findOrFail($quest->id);
            abort_if($lockedQuest->status !== 'active', 409, 'Este reto ya no está activo.');
            abort_if($lockedQuest->creator_id === $request->user()->id, 403, 'No puedes participar en un reto que creaste.');
            abort_if($lockedQuest->due_at && $lockedQuest->due_at->lt(today()), 409, 'El plazo de este reto ya venció.');

            if ($lockedQuest->participants()->whereKey($request->user()->id)->exists()) {
                throw new ConflictHttpException('Ya participas en este reto.');
            }

            $lockedQuest->participants()->attach($request->user()->id, ['progress' => 0, 'completed' => false]);
        });

        return response()->json(['progress' => 0, 'completed' => false]);
    }

    public function updateProgress(Request $request, Quest $quest)
    {
        $data = $request->validate([
            'progress' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $result = DB::transaction(function () use ($request, $quest, $data): array {
            $participant = DB::table('quest_participants')
                ->where('quest_id', $quest->id)
                ->where('user_id', $request->user()->id)
                ->lockForUpdate()
                ->first();
            abort_unless($participant, 403, 'Debes unirte al reto antes de registrar tu progreso.');

            if ($participant->completed) {
                throw new ConflictHttpException('El reto ya está completado.');
            }

            $lockedQuest = Quest::query()->lockForUpdate()->findOrFail($quest->id);
            abort_if($lockedQuest->status !== 'active', 409, 'Este reto ya no está activo.');

            $completed = $data['progress'] === 100;
            DB::table('quest_participants')
                ->where('quest_id', $lockedQuest->id)
                ->where('user_id', $request->user()->id)
                ->update([
                    'progress' => $data['progress'],
                    'completed' => $completed,
                    'updated_at' => now(),
                ]);

            $xpAwarded = $completed ? $lockedQuest->reward_xp : 0;
            if ($xpAwarded > 0) {
                DB::table('users')->where('id', $request->user()->id)->increment('xp_total', $xpAwarded);
            }

            return [
                'progress' => $data['progress'],
                'completed' => $completed,
                'xp_awarded' => $xpAwarded,
                'xp_total' => DB::table('users')->where('id', $request->user()->id)->value('xp_total'),
            ];
        });

        return response()->json($result);
    }

    private function loadForUser(int $questId, int $userId): array
    {
        $quest = Quest::query()
            ->with('creator:id,public_id,name,avatar_url')
            ->withCount('participants')
            ->with(['participants' => fn ($query) => $query->whereKey($userId)->select('users.id')])
            ->findOrFail($questId);

        return $this->payload($quest);
    }

    private function payload(Quest $quest): array
    {
        $participation = $quest->participants->first();

        return [
            'id' => $quest->id,
            'title' => $quest->title,
            'description' => $quest->description,
            'category' => $quest->category,
            'difficulty' => $quest->difficulty,
            'due_at' => $quest->due_at?->format('Y-m-d'),
            'reward_xp' => $quest->reward_xp,
            'participants_count' => $quest->participants_count,
            'creator' => $quest->creator?->only(['public_id', 'name', 'avatar_url']),
            'joined' => $participation !== null,
            'my_progress' => $participation?->pivot->progress,
            'completed' => (bool) ($participation?->pivot->completed ?? false),
        ];
    }
}
