<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quest extends Model
{
    protected $fillable = ['title', 'description', 'category', 'difficulty', 'creator_id', 'due_at', 'reward_xp', 'status'];

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function participants()
    {
        return $this->belongsToMany(User::class, 'quest_participants')->withPivot(['progress', 'completed'])->withTimestamps();
    }
}
