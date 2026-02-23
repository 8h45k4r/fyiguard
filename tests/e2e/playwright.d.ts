/**
 * Local type stubs for @playwright/test v1.44
 * Satisfies TypeScript in environments without node_modules (e.g. vscode.dev).
 */
declare module '@playwright/test' {
  export interface Page {
    goto(url: string, options?: Record<string, unknown>): Promise<null>;
    locator(selector: string): Locator;
    title(): Promise<string>;
    close(): Promise<void>;
  }

  export interface Locator {
    first(): Locator;
    isVisible(): Promise<boolean>;
    click(): Promise<void>;
    fill(value: string): Promise<void>;
    textContent(): Promise<string | null>;
  }

  export interface APIResponse {
    status(): number;
    statusText(): string;
    ok(): boolean;
    json(): Promise<unknown>;
    text(): Promise<string>;
    headers(): Record<string, string>;
  }

  export interface APIRequestContext {
    get(url: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<APIResponse>;
    post(url: string, options?: { data?: unknown; headers?: Record<string, string>; timeout?: number }): Promise<APIResponse>;
    put(url: string, options?: { data?: unknown; headers?: Record<string, string> }): Promise<APIResponse>;
    delete(url: string, options?: { headers?: Record<string, string> }): Promise<APIResponse>;
    patch(url: string, options?: { data?: unknown; headers?: Record<string, string> }): Promise<APIResponse>;
    dispose(): Promise<void>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
    pages(): Page[];
  }

  export interface Browser {
    newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
    launchPersistentContext(userDataDir: string, options?: Record<string, unknown>): Promise<BrowserContext>;
    close(): Promise<void>;
    version(): string;
  }

  export interface Fixtures {
    page: Page;
    request: APIRequestContext;
    context: BrowserContext;
  }

  export interface AsyncMatchers {
    toHaveTitle(title: string | RegExp): Promise<void>;
    toBeVisible(): Promise<void>;
    toBeHidden(): Promise<void>;
  }

  export interface SyncMatchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toHaveProperty(key: string, value?: unknown): void;
    toContain(value: unknown): void;
    not: SyncMatchers;
  }

  export type Matchers = SyncMatchers & AsyncMatchers & { not: Matchers };

  export interface ExpectFn {
    (value: unknown): Matchers;
    (locator: Page | Locator): Matchers & AsyncMatchers;
    soft(value: unknown): Matchers;
  }

  /**
   * TestFn accepts a callback with optional fixtures.
   * Using (fixtures: Fixtures) => ... allows () => ... (0-param functions)
   * to be passed due to TypeScript's function parameter bivariance.
   */
  export interface TestType {
    (title: string, fn: (fixtures: Fixtures) => void | Promise<void>): void;
    describe(title: string, fn: () => void): void;
    only(title: string, fn: (fixtures: Fixtures) => void | Promise<void>): void;
    skip(title: string, fn: (fixtures: Fixtures) => void | Promise<void>): void;
    beforeAll(fn: (fixtures: Fixtures) => void | Promise<void>): void;
    afterAll(fn: (fixtures: Fixtures) => void | Promise<void>): void;
    beforeEach(fn: (fixtures: Fixtures) => void | Promise<void>): void;
    afterEach(fn: (fixtures: Fixtures) => void | Promise<void>): void;
    use(fixtures: Partial<Record<string, unknown>>): void;
  }

  export interface PlaywrightTestConfig {
    testDir?: string;
    timeout?: number;
    retries?: number;
    workers?: number | undefined;
    reporter?: string | Array<[string, Record<string, unknown>]>;
    use?: Record<string, unknown>;
    projects?: Array<{ name: string; use?: Record<string, unknown> }>;
    fullyParallel?: boolean;
    forbidOnly?: boolean;
    baseURL?: string;
  }

  export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
  export const devices: Record<string, Record<string, unknown>>;
  export const test: TestType;
  export const expect: ExpectFn;
  export const chromium: Browser;
}