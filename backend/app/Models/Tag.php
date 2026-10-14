<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    protected $fillable = ['name'];

    public function resources()
    {
        return $this->belongsToMany(Resource::class, 'resource_tag');
    }
}
