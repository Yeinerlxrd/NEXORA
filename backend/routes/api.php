<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::post('/register', [App\Http\Controllers\AuthController::class, 'register']);
Route::post('/login', [App\Http\Controllers\AuthController::class, 'login']);
Route::post('/logout', [App\Http\Controllers\AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/user', [App\Http\Controllers\AuthController::class, 'user'])->middleware('auth:sanctum');
Route::put('/profile', [App\Http\Controllers\AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::put('/profile/password', [App\Http\Controllers\AuthController::class, 'updatePassword'])->middleware('auth:sanctum');

Route::get('/dashboard', [App\Http\Controllers\DashboardController::class, 'index'])->middleware('auth:sanctum');

Route::get('/projects/archived', [App\Http\Controllers\ProjectController::class, 'archived'])->middleware('auth:sanctum');
Route::post('/projects/{project}/archive', [App\Http\Controllers\ProjectController::class, 'archive'])->middleware('auth:sanctum');
Route::post('/projects/{project}/restore', [App\Http\Controllers\ProjectController::class, 'restore'])->middleware('auth:sanctum');
Route::apiResource('/groups', App\Http\Controllers\GroupController::class)->middleware('auth:sanctum');
Route::apiResource('/projects', App\Http\Controllers\ProjectController::class)->middleware('auth:sanctum');
Route::apiResource('/tasks', App\Http\Controllers\TaskController::class)->middleware('auth:sanctum');

Route::get('/health', function () {
    DB::select('SELECT 1');

    return ['status' => 'ok'];
});
