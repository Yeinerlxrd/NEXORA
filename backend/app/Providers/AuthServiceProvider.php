<?php

namespace App\Providers;

use App\Models\FriendRequest;
use App\Models\Group;
use App\Models\Project;
use App\Models\Task;
use App\Policies\FriendRequestPolicy;
use App\Policies\GroupPolicy;
use App\Policies\ProjectPolicy;
use App\Policies\TaskPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Group::class => GroupPolicy::class,
        FriendRequest::class => FriendRequestPolicy::class,
        Project::class => ProjectPolicy::class,
        Task::class => TaskPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();

        RateLimiter::for('login', function (Request $request): array {
            $email = $request->input('email');
            $emailKey = is_string($email) ? Str::lower($email) : 'invalid';

            return [
                Limit::perMinute(30)->by('login-ip:'.$request->ip()),
                Limit::perMinute(5)->by('login-credential:'.$request->ip().'|'.$emailKey),
            ];
        });

        RateLimiter::for('register', function (Request $request): array {
            $ip = $request->ip();

            return [
                Limit::perMinute(3)->by('register-minute:'.$ip),
                Limit::perHour(10)->by('register-hour:'.$ip),
            ];
        });

        RateLimiter::for('password-change', function (Request $request): Limit {
            $userId = $request->user()?->getAuthIdentifier() ?? 'guest';

            return Limit::perMinute(5)->by('password-change:'.$userId.'|'.$request->ip());
        });
    }
}
