<?php

use Laravel\Sanctum\Sanctum;

return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,127.0.0.1')),
    'guard' => ['web'],
    'expiration' => null,
    'token_prefix' => 'nexora_',
    'middleware' => ['encrypt_cookies', 'verify_csrf', 'authenticate_session'],
    'providers' => [
        Sanctum::class,
    ],
];
