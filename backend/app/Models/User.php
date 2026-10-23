<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'name',
        'email',
        'public_id',
        'password',
        'avatar_url',
        'bio',
    ];

    protected $casts = [
        'xp_total' => 'integer',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected static function booted(): void
    {
        static::creating(function (User $user): void {
            $user->public_id ??= (string) Str::uuid();
        });
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class, 'group_members')->withPivot('role')->withTimestamps();
    }

    public function projects()
    {
        return $this->hasMany(Project::class, 'creator_id');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function sentFriendRequests(): HasMany
    {
        return $this->hasMany(FriendRequest::class, 'sender_id');
    }

    public function receivedFriendRequests(): HasMany
    {
        return $this->hasMany(FriendRequest::class, 'recipient_id');
    }
}
