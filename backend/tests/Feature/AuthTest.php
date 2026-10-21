<?php

namespace Tests\Feature;

use App\Models\User;
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
            ->assertJsonPath('user.email', 'ana@nexora.test');
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
}
