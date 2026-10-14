<?php

use Illuminate\Support\ServiceProvider;

return [
    'name' => env('APP_NAME', 'NEXORA'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'Europe/Madrid',
    'locale' => 'es',
    'fallback_locale' => 'es',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'providers' => ServiceProvider::defaultProviders()->merge([
        App\Providers\AuthServiceProvider::class,
    ])->toArray(),
];
