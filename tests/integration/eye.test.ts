import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { createEye, getBrowserWSUrl } from '../../src/index';

describe('Eye Integration', () => {
  let browser: Browser | null = null;
  let page: Page | null = null;

  beforeAll(async () => {
    // Connect to browser with remote debugging
    const wsUrl = await getBrowserWSUrl();
    if (!wsUrl) {
      throw new Error('Could not get WebSocket URL. Make sure Chrome is running with --remote-debugging-port=9222');
    }
    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.disconnect();
    }
  });

  beforeEach(async () => {
    if (browser) {
      const pages = await browser.pages();
      // Use existing page or create new one
      page = pages[0] || await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
    }
  });

  describe('createEye', () => {
    it('should create eye instance with puppeteer platform', async () => {
      expect(page).toBeDefined();
      
      const eye = await createEye({
        platform: { name: 'puppeteer', page: page! },
      });
      
      expect(eye).toBeDefined();
      expect(eye.look).toBeDefined();
      expect(eye.wait).toBeDefined();
      expect(eye.act).toBeDefined();
      expect(eye.snapshot).toBeDefined();
      expect(eye.blink).toBeDefined();
    });
  });

  describe('snapshot', () => {
    it('should take a11y snapshot of a page', async () => {
      await page!.goto('https://example.com');
      
      const eye = await createEye({
        platform: { name: 'puppeteer', page: page! },
      });
      
      const snapshot = await eye.snapshot();
      
      expect(snapshot).toBeDefined();
      expect(typeof snapshot).toBe('string');
      // Should contain some a11y information
      expect(snapshot.length).toBeGreaterThan(0);
    }, 30000);

    it('should take JSON snapshot', async () => {
      await page!.goto('https://example.com');
      
      const eye = await createEye({
        platform: { name: 'puppeteer', page: page! },
      });
      
      const snapshot = await eye.snapshot(false);
      
      expect(snapshot).toBeDefined();
      expect(typeof snapshot).toBe('string');
    });
  });

  describe('look', () => {
    it('should find elements on the page', async () => {
      await page!.goto('https://example.com');
      
      const eye = await createEye({
        platform: { name: 'puppeteer', page: page! },
      });
      
      // Look for h1 element
      const element = await eye.look('heading level 1');
      
      expect(element).toBeDefined();
    });
  });

  describe('blink', () => {
    it('should blink for specified duration', async () => {
      const eye = await createEye({
        platform: { name: 'puppeteer', page: page! },
      });
      
      const start = Date.now();
      await eye.blink(100);
      const duration = Date.now() - start;
      
      // Allow some tolerance
      expect(duration).toBeGreaterThanOrEqual(80);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('wait', () => {
    it('should wait for element to appear with default threshold', async () => {
      await page!.goto('https://example.com');
      
      const eye = await createEye({
        platform: { name: 'puppeteer', page: page! },
      });
      
      // h1 already exists on example.com, use default threshold
      const element = await eye.wait('example heading');
      
      expect(element).toBeDefined();
    }, 60000);
  });
});
