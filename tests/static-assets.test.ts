import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Test to ensure all static asset references in code actually exist on disk.
 * Prevents broken images in production due to case-sensitivity or missing files.
 * 
 * This test dynamically scans the codebase for references, so no manual maintenance needed.
 */
describe('Static Assets', () => {
  const publicDir = path.join(process.cwd(), 'public');

  describe('Profile Pictures', () => {
    const profilePicsDir = path.join(publicDir, 'profile-pictures');
    
    // Get all actual files (case-sensitive)
    const actualFiles = fs.existsSync(profilePicsDir)
      ? fs.readdirSync(profilePicsDir).filter(f => !f.startsWith('.'))
      : [];

    it('should have profile-pictures directory', () => {
      expect(fs.existsSync(profilePicsDir)).toBe(true);
    });

    /**
     * Dynamically scan codebase for profile picture references
     */
    function findProfilePictureReferences(): Set<string> {
      const references = new Set<string>();
      const srcDir = path.join(process.cwd(), 'src');
      
      // Find all source files
      const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
        cwd: srcDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.next/**'],
      });

      // Regex to match /profile-pictures/filename patterns
      const profilePicRegex = /['"`]\/profile-pictures\/([^'"`]+)['"`]/g;

      files.forEach((file: string) => {
        const content = fs.readFileSync(file, 'utf-8');
        let match;
        
        while ((match = profilePicRegex.exec(content)) !== null) {
          references.add(match[1]);
        }
      });

      return references;
    }

    const referencedFiles = Array.from(findProfilePictureReferences());

    it('should find profile picture references in codebase', () => {
      expect(referencedFiles.length).toBeGreaterThan(0);
    });

    referencedFiles.forEach((filename) => {
      it(`should have referenced file: ${filename}`, () => {
        expect(actualFiles).toContain(filename);
        
        // Also verify the file actually exists (case-sensitive check)
        const fullPath = path.join(profilePicsDir, filename);
        expect(fs.existsSync(fullPath), `File not found: ${fullPath}`).toBe(true);
      });
    });

    it('should not have unused profile pictures (optional warning)', () => {
      const unused = actualFiles.filter(f => !referencedFiles.includes(f));
      if (unused.length > 0) {
        console.warn(`⚠️  Unused profile pictures detected: ${unused.join(', ')}`);
      }
      // Not failing - just informational
      expect(unused).toBeDefined();
    });
  });

  describe('Logo Assets', () => {
    const logosDir = path.join(publicDir, 'logos');
    
    it('should have logos directory', () => {
      expect(fs.existsSync(logosDir)).toBe(true);
    });

    // Verify key logo variants exist
    const requiredLogoVariants = [
      'Health Logos - black',
      'Health Logos - white',
      'Health Logos - tree',
    ];

    requiredLogoVariants.forEach((variant) => {
      it(`should have logo variant: ${variant}`, () => {
        const variantPath = path.join(logosDir, variant);
        expect(fs.existsSync(variantPath), `Logo variant not found: ${variant}`).toBe(true);
      });
    });
  });
});
