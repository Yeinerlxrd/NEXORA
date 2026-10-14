<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected $seed = false;

    protected function setUp(): void
    {
        parent::setUp();
    }
}
