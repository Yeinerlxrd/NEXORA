<?php

namespace Database\Seeders;

use App\Models\Badges;
use App\Models\Group;
use App\Models\Project;
use App\Models\Quest;
use App\Models\Resource;
use App\Models\Tag;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use LogicException;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new LogicException('DemoSeeder cannot run in production because it creates public demo accounts.');
        }

        $demoUser = User::firstOrCreate([
            'email' => 'demo@nexora.local',
        ], [
            'name' => 'Demo User',
            'password' => Hash::make('demo1234'),
            'bio' => 'Usuario de demostración para NEXORA.',
        ]);

        $secondUser = User::firstOrCreate([
            'email' => 'alex@nexora.local',
        ], [
            'name' => 'Alex Torres',
            'password' => Hash::make('demo1234'),
            'bio' => 'Colaborador del proyecto.',
        ]);

        $group = Group::firstOrCreate([
            'name' => 'Equipo NEXORA',
        ], [
            'description' => 'Grupo de demostración para colaboración y tareas.',
            'owner_id' => $demoUser->id,
        ]);

        $group->members()->syncWithoutDetaching([
            $demoUser->id => ['role' => 'Owner'],
            $secondUser->id => ['role' => 'Member'],
        ]);

        $project = Project::firstOrCreate([
            'name' => 'Plan de lanzamiento NEXORA',
        ], [
            'description' => 'Proyecto de ejemplo para dashboard, tareas y colaboración.',
            'creator_id' => $demoUser->id,
            'group_id' => $group->id,
            'status' => 'En progreso',
            'priority' => 'Alta',
            'due_at' => now()->addDays(9),
        ]);

        Task::firstOrCreate([
            'title' => 'Diseñar layout principal',
        ], [
            'description' => 'Preparar el diseño base del dashboard premium.',
            'project_id' => $project->id,
            'creator_id' => $demoUser->id,
            'assignee_id' => $demoUser->id,
            'status' => 'En progreso',
            'priority' => 'Alta',
            'due_at' => now()->addDays(2),
        ]);

        Task::firstOrCreate([
            'title' => 'Validar flujo de registro',
        ], [
            'description' => 'Completar login, registro y acceso protegidos.',
            'project_id' => $project->id,
            'creator_id' => $demoUser->id,
            'assignee_id' => $secondUser->id,
            'status' => 'Pendiente',
            'priority' => 'Media',
            'due_at' => now()->addDays(5),
        ]);

        $tag1 = Tag::firstOrCreate(['name' => 'frontend']);
        $tag2 = Tag::firstOrCreate(['name' => 'ux']);

        $resource = Resource::firstOrCreate([
            'title' => 'Guía de diseño SaaS',
        ], [
            'description' => 'Recursos para diseñar interfaces premium con buenas métricas.',
            'url' => 'https://example.com/guide',
            'type' => 'tutorial',
            'author_id' => $demoUser->id,
            'group_id' => $group->id,
        ]);

        $resource->tags()->syncWithoutDetaching([$tag1->id, $tag2->id]);

        $quest = Quest::firstOrCreate([
            'title' => 'Reto de productividad semanal',
        ], [
            'description' => 'Completa una iniciativa de trabajo en equipo y registra tus avances.',
            'category' => 'Productividad',
            'difficulty' => 'Media',
            'creator_id' => $demoUser->id,
            'due_at' => now()->addDays(7),
            'reward_xp' => 120,
            'status' => 'active',
        ]);

        $quest->participants()->syncWithoutDetaching([$demoUser->id => ['progress' => 60, 'completed' => false]]);

        Badges::firstOrCreate([
            'name' => 'Primera colaboración',
        ], [
            'description' => 'Insignia entregada al completar el primer reto de equipo.',
            'icon' => 'sparkles',
        ]);
    }
}
