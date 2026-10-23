<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Ana López',
            'email' => 'ana@nexora.test',
            'password' => 'securePass123',
            'password_confirmation' => 'securePass123',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', 'ana@nexora.test')
            ->assertJsonPath('user.xp_total', 0);

        $this->assertDatabaseHas('users', ['email' => 'ana@nexora.test', 'xp_total' => 0]);
    }

    public function test_registration_and_login_reject_emails_longer_than_the_database_column(): void
    {
        $email = str_repeat('a', 64).'@'.str_repeat('b', 63).'.'.str_repeat('c', 63).'.'.str_repeat('d', 63);
        $expectedMessage = 'El correo electrónico no puede superar los 255 caracteres.';

        $this->postJson('/api/register', [
            'name' => 'Correo extenso',
            'email' => $email,
            'password' => 'securePass123',
            'password_confirmation' => 'securePass123',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', $expectedMessage);

        $this->postJson('/api/login', [
            'email' => $email,
            'password' => 'incorrect-password',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', $expectedMessage);
    }

    public function test_registration_token_authenticates_protected_routes(): void
    {
        $registration = $this->postJson('/api/register', [
            'name' => 'Token QA',
            'email' => 'token-qa@nexora.test',
            'password' => 'securePass123',
            'password_confirmation' => 'securePass123',
        ])->assertCreated();

        $token = $registration->json('token');

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('email', 'token-qa@nexora.test');
    }

    public function test_logout_revokes_the_authenticated_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('logout-test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertOk();

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertUnauthorized();
    }

    public function test_password_change_revokes_all_existing_tokens(): void
    {
        $user = User::factory()->create([
            'password' => bcrypt('current-password'),
        ]);
        $currentToken = $user->createToken('current-device')->plainTextToken;
        $otherDeviceToken = $user->createToken('other-device')->plainTextToken;

        $this->withToken($currentToken)
            ->putJson('/api/profile/password', [
                'current_password' => 'current-password',
                'password' => 'new-password-123',
                'password_confirmation' => 'new-password-123',
            ])
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
        ]);

        $this->withToken($otherDeviceToken)
            ->getJson('/api/user')
            ->assertUnauthorized();
    }

    public function test_password_change_with_wrong_current_password_keeps_existing_token(): void
    {
        $user = User::factory()->create([
            'password' => bcrypt('current-password'),
        ]);
        $token = $user->createToken('password-test')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/profile/password', [
                'current_password' => 'wrong-password',
                'password' => 'new-password-123',
                'password_confirmation' => 'new-password-123',
            ])
            ->assertUnprocessable();

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertOk();
    }

    public function test_password_change_is_limited_after_repeated_wrong_current_passwords(): void
    {
        $user = User::factory()->create(['password' => bcrypt('current-password')]);
        $token = $user->createToken('password-change-limit')->plainTextToken;

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->withToken($token)
                ->putJson('/api/profile/password', [
                    'current_password' => 'wrong-password',
                    'password' => 'new-password-123',
                    'password_confirmation' => 'new-password-123',
                ])
                ->assertUnprocessable();
        }

        $this->withToken($token)
            ->putJson('/api/profile/password', [
                'current_password' => 'wrong-password',
                'password' => 'new-password-123',
                'password_confirmation' => 'new-password-123',
            ])
            ->assertTooManyRequests()
            ->assertJsonStructure(['message']);
    }

    public function test_expired_sanctum_token_cannot_access_protected_routes(): void
    {
        config(['sanctum.expiration' => 60]);
        $user = User::factory()->create();

        $this->travel(-2)->hours();
        $token = $user->createToken('expired-test')->plainTextToken;
        $this->travelBack();

        $this->withToken($token)
            ->getJson('/api/user')
            ->assertUnauthorized();
    }

    public function test_private_route_requires_authentication(): void
    {
        $response = $this->getJson('/api/dashboard');

        $response->assertStatus(401);
    }

    public function test_health_endpoint_reports_healthy_when_database_is_available(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertExactJson(['status' => 'ok']);
    }

    public function test_user_can_login_and_access_dashboard(): void
    {
        $user = User::factory()->create([
            'email' => 'demo@nexora.test',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'demo@nexora.test',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.email', 'demo@nexora.test');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/dashboard')
            ->assertStatus(200);
    }

    public function test_dashboard_counts_review_tasks_and_excludes_completed_upcoming_tasks(): void
    {
        $this->travelTo(now()->startOfDay());
        $user = User::factory()->create();
        $project = Project::create([
            'name' => 'Dashboard project',
            'creator_id' => $user->id,
            'status' => 'En progreso',
            'priority' => 'Media',
        ]);

        foreach (['Pendiente', 'En progreso', 'En revisión', 'Completada'] as $status) {
            Task::create([
                'title' => 'Task '.$status,
                'project_id' => $project->id,
                'creator_id' => $user->id,
                'assignee_id' => $user->id,
                'status' => $status,
                'priority' => 'Media',
                'due_at' => now()->addDays(2),
            ]);
        }

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('summary.pending_tasks', 3)
            ->assertJsonCount(3, 'upcoming_tasks')
            ->assertJsonMissingPath('upcoming_tasks.0.creator_id')
            ->assertJsonMissingPath('upcoming_tasks.0.assignee_id')
            ->assertJsonPath('recent_projects.0.creator_public_id', $user->public_id)
            ->assertJsonMissingPath('recent_projects.0.creator_id');

        $this->travelBack();
    }

    public function test_dashboard_upcoming_count_includes_tasks_beyond_the_five_item_preview(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'name' => 'Many upcoming tasks',
            'creator_id' => $user->id,
            'status' => 'En progreso',
            'priority' => 'Media',
        ]);

        for ($index = 1; $index <= 7; $index++) {
            Task::create([
                'title' => 'Upcoming task '.$index,
                'project_id' => $project->id,
                'creator_id' => $user->id,
                'assignee_id' => $user->id,
                'status' => 'Pendiente',
                'priority' => 'Media',
                'due_at' => today()->addDays($index),
            ]);
        }

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('summary.upcoming_tasks', 7)
            ->assertJsonCount(5, 'upcoming_tasks');
    }

    public function test_calendar_due_dates_keep_their_day_and_remain_upcoming_throughout_that_day(): void
    {
        $today = today()->toDateString();
        $user = User::factory()->create();
        $project = Project::create([
            'name' => 'Entrega de hoy',
            'creator_id' => $user->id,
            'status' => 'En progreso',
            'priority' => 'Media',
            'due_at' => $today,
        ]);
        $task = Task::create([
            'title' => 'Vence hoy',
            'project_id' => $project->id,
            'creator_id' => $user->id,
            'assignee_id' => $user->id,
            'status' => 'Pendiente',
            'priority' => 'Alta',
            'due_at' => $today,
        ]);

        $this->travelTo(today()->endOfDay());

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/projects')
            ->assertOk()
            ->assertJsonPath('0.due_at', $today);

        $this->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonPath('0.due_at', $today);

        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonCount(1, 'upcoming_tasks')
            ->assertJsonPath('upcoming_tasks.0.id', $task->id)
            ->assertJsonPath('upcoming_tasks.0.due_at', $today);

        $this->travelBack();
    }

    public function test_dashboard_uses_the_configured_bogota_calendar_day_near_utc_midnight(): void
    {
        try {
            $this->assertSame('America/Bogota', config('app.timezone'));
            $this->travelTo(Carbon::parse('2026-10-21 01:00:00', 'UTC'));
            $user = User::factory()->create();
            $project = Project::create([
                'name' => 'Entrega local de hoy',
                'creator_id' => $user->id,
                'status' => 'En progreso',
                'priority' => 'Media',
            ]);
            Task::create([
                'title' => 'Vence hoy en Bogotá',
                'project_id' => $project->id,
                'creator_id' => $user->id,
                'assignee_id' => $user->id,
                'status' => 'Pendiente',
                'priority' => 'Alta',
                'due_at' => '2026-10-20',
            ]);

            $this->actingAs($user, 'sanctum')
                ->getJson('/api/dashboard')
                ->assertOk()
                ->assertJsonPath('summary.upcoming_tasks', 1)
                ->assertJsonPath('upcoming_tasks.0.due_at', '2026-10-20')
                ->assertJsonPath('date', 'martes, 20 de octubre de 2026');
        } finally {
            $this->travelBack();
        }
    }

    public function test_project_archive_is_managed_through_the_reversible_archive_operation(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/projects', [
                'name' => 'Invalid status project',
                'status' => 'Archivado',
                'priority' => 'Media',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_login_is_limited_after_repeated_invalid_credentials(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login', [
                'email' => 'target@nexora.test',
                'password' => 'incorrect-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/login', [
            'email' => 'target@nexora.test',
            'password' => 'incorrect-password',
        ])->assertTooManyRequests()
            ->assertJsonStructure(['message']);
    }

    public function test_login_rate_limit_uses_forwarded_client_ip_from_the_trusted_proxy(): void
    {
        for ($attempt = 1; $attempt <= 6; $attempt++) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.5'])
                ->withHeader('X-Forwarded-For', '198.51.100.'.$attempt)
                ->postJson('/api/login', [
                    'email' => 'shared-proxy@nexora.test',
                    'password' => 'incorrect-password',
                ])
                ->assertUnprocessable();
        }
    }

    public function test_registration_is_limited_and_normal_registration_still_succeeds(): void
    {
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->postJson('/api/register', [
                'name' => 'Registration '.$attempt,
                'email' => 'registration'.$attempt.'@nexora.test',
                'password' => 'securePass123',
                'password_confirmation' => 'securePass123',
            ])->assertCreated();
        }

        $this->postJson('/api/register', [
            'name' => 'Registration blocked',
            'email' => 'blocked@nexora.test',
            'password' => 'securePass123',
            'password_confirmation' => 'securePass123',
        ])->assertTooManyRequests()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseCount('users', 3);
    }
}
