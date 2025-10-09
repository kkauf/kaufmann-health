import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Comprehensive API route validation test.
 * 
 * Prevents broken API calls by:
 * 1. Discovering all actual API routes from file structure
 * 2. Scanning codebase for fetch() calls to /api/* endpoints
 * 3. Validating that every called route actually exists
 * 
 * Zero manual maintenance - automatically adapts to route changes.
 */
describe('API Route Validation', () => {
  /**
   * Discover all API routes by scanning the file structure
   */
  function discoverApiRoutes(): Set<string> {
    const routes = new Set<string>();
    const apiDir = path.join(process.cwd(), 'src/app/api');

    if (!fs.existsSync(apiDir)) {
      return routes;
    }

    // Find all route.ts files
    const routeFiles = glob.sync('**/route.{ts,tsx,js,jsx}', {
      cwd: apiDir,
      absolute: true,
    });

    routeFiles.forEach((file) => {
      // Convert file path to route pattern
      // e.g., src/app/api/public/therapists/[id]/profile/route.ts
      //    -> /api/public/therapists/[id]/profile
      const relativePath = path.relative(apiDir, path.dirname(file));
      const routePath = '/api/' + relativePath.replace(/\\/g, '/');
      routes.add(routePath);
    });

    return routes;
  }

  /**
   * Extract API route calls from source code
   */
  function findApiRouteCalls(): Map<string, { file: string; line: number; fullCall: string }[]> {
    const calls = new Map<string, { file: string; line: number; fullCall: string }[]>();
    const srcDir = path.join(process.cwd(), 'src');

    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      cwd: srcDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.next/**'],
    });

    // Regex to match fetch('/api/...') or fetch(`/api/...`)
    // Captures the path including template literals
    const fetchRegex = /fetch\s*\(\s*[`'"](\/(api\/[^`'"]+))[`'"]/g;

    files.forEach((file: string) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, idx) => {
        let match;
        const regex = new RegExp(fetchRegex);
        
        while ((match = regex.exec(line)) !== null) {
          const fullPath = match[1];
          const apiPath = '/' + match[2];
          
          if (!calls.has(apiPath)) {
            calls.set(apiPath, []);
          }
          
          calls.get(apiPath)!.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            fullCall: match[0],
          });
        }
      });
    });

    return calls;
  }

  /**
   * Normalize a route path by replacing dynamic segments with [id] pattern
   */
  function normalizeRoutePath(routePath: string): string {
    // Replace actual IDs/UUIDs with [id] pattern
    return routePath
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[id]')
      .replace(/\/\d+/g, '/[id]')
      // Handle template literal params like ${id}, ${therapistId}, etc.
      .replace(/\/\$\{[^}]+\}/g, '/[id]');
  }

  /**
   * Check if a called route matches any existing route pattern
   */
  function routeExists(calledRoute: string, existingRoutes: Set<string>): boolean {
    const normalized = normalizeRoutePath(calledRoute);
    
    // Direct match
    if (existingRoutes.has(normalized)) {
      return true;
    }

    // Check if it's a subpath (for catchall routes)
    for (const route of existingRoutes) {
      if (route.includes('[...') && normalized.startsWith(route.split('[...')[0])) {
        return true;
      }
    }

    return false;
  }

  const existingRoutes = discoverApiRoutes();
  const apiCalls = findApiRouteCalls();

  it('should discover API routes from file structure', () => {
    expect(existingRoutes.size).toBeGreaterThan(0);
    
    // Verify key routes exist
    expect(Array.from(existingRoutes)).toContain('/api/public/leads');
    expect(Array.from(existingRoutes)).toContain('/api/public/therapists/[id]/profile');
  });

  it('should find API calls in codebase', () => {
    expect(apiCalls.size).toBeGreaterThan(0);
  });

  describe('Route Call Validation', () => {
    const invalidCalls: Array<{
      route: string;
      locations: Array<{ file: string; line: number }>;
    }> = [];

    apiCalls.forEach((locations, route) => {
      const exists = routeExists(route, existingRoutes);
      
      if (!exists) {
        invalidCalls.push({
          route,
          locations: locations.map(({ file, line }) => ({ file, line })),
        });
      }
    });

    it('should not have calls to non-existent routes', () => {
      if (invalidCalls.length > 0) {
        const errorMessage = invalidCalls
          .map(({ route, locations }) => {
            const locationStr = locations
              .map(({ file, line }) => `    ${file}:${line}`)
              .join('\n');
            return `\n  ❌ ${route}\n${locationStr}`;
          })
          .join('\n');

        throw new Error(
          `Found ${invalidCalls.length} call(s) to non-existent API routes:${errorMessage}\n\n` +
          `Available routes:\n${Array.from(existingRoutes).sort().map(r => `  - ${r}`).join('\n')}`
        );
      }

      expect(invalidCalls).toHaveLength(0);
    });

    // Individual test for each unique route call (for better visibility)
    Array.from(new Set(apiCalls.keys())).forEach((route) => {
      it(`should have route: ${route}`, () => {
        const exists = routeExists(route, existingRoutes);
        
        if (!exists) {
          const locations = apiCalls.get(route)!;
          const locationStr = locations
            .map(({ file, line }) => `  ${file}:${line}`)
            .join('\n');
          
          throw new Error(
            `Route not found: ${route}\n` +
            `Called from:\n${locationStr}\n\n` +
            `Normalized: ${normalizeRoutePath(route)}\n` +
            `Did you mean one of these?\n${Array.from(existingRoutes)
              .filter(r => r.includes(route.split('/').slice(0, 4).join('/')))
              .map(r => `  - ${r}`)
              .join('\n')}`
          );
        }

        expect(exists).toBe(true);
      });
    });
  });

  describe('Route Health Checks', () => {
    it('should not have unused routes (warning only)', () => {
      const calledRoutePatterns = new Set(
        Array.from(apiCalls.keys()).map(normalizeRoutePath)
      );

      const unusedRoutes = Array.from(existingRoutes).filter(
        (route) => !calledRoutePatterns.has(route) && !route.includes('[...')
      );

      if (unusedRoutes.length > 0) {
        console.warn(
          `\n⚠️  Found ${unusedRoutes.length} potentially unused routes:\n` +
          unusedRoutes.map(r => `  - ${r}`).join('\n')
        );
      }

      // Not failing - just informational
      expect(unusedRoutes).toBeDefined();
    });

    it('should not have legacy /api/therapists/* routes', () => {
      const legacyRoutes = Array.from(existingRoutes).filter(
        (route) => route.match(/^\/api\/therapists\//) && !route.includes('/public/')
      );

      expect(legacyRoutes).toHaveLength(0);
    });

    it('should prefer /api/public/* over /api/* for public routes', () => {
      const topLevelPublicRoutes = Array.from(existingRoutes).filter(
        (route) => 
          route.startsWith('/api/') && 
          !route.startsWith('/api/admin/') &&
          !route.startsWith('/api/public/') &&
          !route.startsWith('/api/internal/') &&
          route !== '/api/events' // Allowed exception
      );

      if (topLevelPublicRoutes.length > 0) {
        console.warn(
          `\n⚠️  Consider moving these to /api/public/*:\n` +
          topLevelPublicRoutes.map(r => `  - ${r}`).join('\n')
        );
      }

      // Not enforcing yet - just warning
      expect(topLevelPublicRoutes).toBeDefined();
    });
  });
});
