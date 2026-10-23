<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected $seed = false;

    protected function setUp(): void
    {
        $this->refreshApplication();
        // Override cached Laravel configuration too; tests must never use the
        // development connection, even if the parent container uses MariaDB.
        $this->app['config']->set('app.env', 'testing');
        $this->app['config']->set('database.default', 'sqlite');
        $this->app['config']->set('database.connections.sqlite.database', ':memory:');
        $this->app['config']->set('cache.default', 'array');

        parent::setUp();
    }
}
