<?php

use App\Providers\AuthServiceProvider;
use Illuminate\Support\ServiceProvider;

return [
    'name' => env('APP_NAME', 'NEXORA'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => env('APP_TIMEZONE', 'America/Bogota'),
    'locale' => 'es',
    'fallback_locale' => 'es',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'providers' => ServiceProvider::defaultProviders()->merge([
        AuthServiceProvider::class,
    ])->toArray(),
];
