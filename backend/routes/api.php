<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FriendshipController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\GroupInvitationController;
use App\Http\Controllers\GroupMemberController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\QuestController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
Route::put('/profile', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::put('/profile/password', [AuthController::class, 'updatePassword'])
    ->middleware(['auth:sanctum', 'throttle:password-change']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/quests', [QuestController::class, 'index']);
    Route::post('/quests', [QuestController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/quests/{quest}/join', [QuestController::class, 'join'])->middleware('throttle:30,1');
    Route::patch('/quests/{quest}/progress', [QuestController::class, 'updateProgress'])->middleware('throttle:60,1');

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::get('/users', [FriendshipController::class, 'search']);
    Route::get('/users/{user:public_id}', [FriendshipController::class, 'show']);
    Route::get('/friends', [FriendshipController::class, 'friends']);
    Route::delete('/friends/{user:public_id}', [FriendshipController::class, 'removeFriend']);
    Route::get('/friend-requests/sent', [FriendshipController::class, 'sentRequests']);
    Route::get('/friend-requests/received', [FriendshipController::class, 'receivedRequests']);
    Route::post('/friend-requests', [FriendshipController::class, 'sendRequest']);
    Route::post('/friend-requests/{friendRequest}/accept', [FriendshipController::class, 'acceptRequest']);
    Route::post('/friend-requests/{friendRequest}/reject', [FriendshipController::class, 'rejectRequest']);
    Route::delete('/friend-requests/{friendRequest}', [FriendshipController::class, 'cancelRequest']);

    Route::get('/group-invitations/received', [GroupInvitationController::class, 'received']);
    Route::post('/group-invitations/{invitation}/accept', [GroupInvitationController::class, 'accept']);
    Route::post('/group-invitations/{invitation}/reject', [GroupInvitationController::class, 'reject']);
    Route::delete('/group-invitations/{invitation}', [GroupInvitationController::class, 'cancel']);
    Route::post('/groups/{group}/invitations', [GroupInvitationController::class, 'store']);
    Route::get('/groups/{group}/invitations', [GroupInvitationController::class, 'sent']);
    Route::get('/groups/{group}/members', [GroupMemberController::class, 'index']);
    Route::patch('/groups/{group}/members/{member:public_id}', [GroupMemberController::class, 'update']);
    Route::delete('/groups/{group}/members/{member:public_id}', [GroupMemberController::class, 'destroy']);
    Route::delete('/groups/{group}/membership', [GroupMemberController::class, 'leave']);
});

Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('auth:sanctum');

Route::get('/projects/archived', [ProjectController::class, 'archived'])->middleware('auth:sanctum');
Route::post('/projects/{project}/archive', [ProjectController::class, 'archive'])->middleware('auth:sanctum');
Route::post('/projects/{project}/restore', [ProjectController::class, 'restore'])->middleware('auth:sanctum');
Route::apiResource('/groups', GroupController::class)->middleware('auth:sanctum');
Route::apiResource('/projects', ProjectController::class)->middleware('auth:sanctum');
Route::apiResource('/tasks', TaskController::class)->middleware('auth:sanctum');

Route::get('/health', function () {
    DB::select('SELECT 1');

    return ['status' => 'ok'];
});
