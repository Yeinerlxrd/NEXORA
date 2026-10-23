<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::post('/register', [App\Http\Controllers\AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [App\Http\Controllers\AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/logout', [App\Http\Controllers\AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/user', [App\Http\Controllers\AuthController::class, 'user'])->middleware('auth:sanctum');
Route::put('/profile', [App\Http\Controllers\AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::put('/profile/password', [App\Http\Controllers\AuthController::class, 'updatePassword'])
    ->middleware(['auth:sanctum', 'throttle:password-change']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/quests', [App\Http\Controllers\QuestController::class, 'index']);
    Route::post('/quests', [App\Http\Controllers\QuestController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/quests/{quest}/join', [App\Http\Controllers\QuestController::class, 'join'])->middleware('throttle:30,1');
    Route::patch('/quests/{quest}/progress', [App\Http\Controllers\QuestController::class, 'updateProgress'])->middleware('throttle:60,1');

    Route::get('/notifications', [App\Http\Controllers\NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [App\Http\Controllers\NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/read-all', [App\Http\Controllers\NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [App\Http\Controllers\NotificationController::class, 'markRead']);

    Route::get('/users', [App\Http\Controllers\FriendshipController::class, 'search']);
    Route::get('/users/{user:public_id}', [App\Http\Controllers\FriendshipController::class, 'show']);
    Route::get('/friends', [App\Http\Controllers\FriendshipController::class, 'friends']);
    Route::delete('/friends/{user:public_id}', [App\Http\Controllers\FriendshipController::class, 'removeFriend']);
    Route::get('/friend-requests/sent', [App\Http\Controllers\FriendshipController::class, 'sentRequests']);
    Route::get('/friend-requests/received', [App\Http\Controllers\FriendshipController::class, 'receivedRequests']);
    Route::post('/friend-requests', [App\Http\Controllers\FriendshipController::class, 'sendRequest']);
    Route::post('/friend-requests/{friendRequest}/accept', [App\Http\Controllers\FriendshipController::class, 'acceptRequest']);
    Route::post('/friend-requests/{friendRequest}/reject', [App\Http\Controllers\FriendshipController::class, 'rejectRequest']);
    Route::delete('/friend-requests/{friendRequest}', [App\Http\Controllers\FriendshipController::class, 'cancelRequest']);

    Route::get('/group-invitations/received', [App\Http\Controllers\GroupInvitationController::class, 'received']);
    Route::post('/group-invitations/{invitation}/accept', [App\Http\Controllers\GroupInvitationController::class, 'accept']);
    Route::post('/group-invitations/{invitation}/reject', [App\Http\Controllers\GroupInvitationController::class, 'reject']);
    Route::delete('/group-invitations/{invitation}', [App\Http\Controllers\GroupInvitationController::class, 'cancel']);
    Route::post('/groups/{group}/invitations', [App\Http\Controllers\GroupInvitationController::class, 'store']);
    Route::get('/groups/{group}/invitations', [App\Http\Controllers\GroupInvitationController::class, 'sent']);
    Route::get('/groups/{group}/members', [App\Http\Controllers\GroupMemberController::class, 'index']);
    Route::patch('/groups/{group}/members/{member:public_id}', [App\Http\Controllers\GroupMemberController::class, 'update']);
    Route::delete('/groups/{group}/members/{member:public_id}', [App\Http\Controllers\GroupMemberController::class, 'destroy']);
    Route::delete('/groups/{group}/membership', [App\Http\Controllers\GroupMemberController::class, 'leave']);
});

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
