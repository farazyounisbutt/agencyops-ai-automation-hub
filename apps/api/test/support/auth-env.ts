import { testClerkEnvironment } from './clerk-fixture.js';
// Explicit test configuration only; never an application authentication bypass.
Object.assign(process.env, testClerkEnvironment());
