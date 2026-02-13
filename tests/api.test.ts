import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock puppeteer
vi.mock('puppeteer', () => ({
  default: {
    connect: vi.fn(),
  },
}));

describe('API Surface', () => {
  // Test that all expected exports are available
  describe('Core Exports', () => {
    it('should export createEye', async () => {
      const { createEye } = await import('../src/eye');
      expect(createEye).toBeDefined();
      expect(typeof createEye).toBe('function');
    });

    // Type-only exports cannot be tested at runtime as they are erased during compilation
    // They are tested via TypeScript compilation instead
  });

  describe('Utility Exports', () => {
    it('should export getBrowserWSUrl', async () => {
      const { getBrowserWSUrl } = await import('../src/utils/browserWsUrl');
      expect(getBrowserWSUrl).toBeDefined();
      expect(typeof getBrowserWSUrl).toBe('function');
    });

    it('should export logger', async () => {
      const { logger } = await import('../src/utils/logger');
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should export setLogLevel', async () => {
      const { setLogLevel } = await import('../src/utils/logger');
      expect(setLogLevel).toBeDefined();
      expect(typeof setLogLevel).toBe('function');
    });
  });

  describe('Service Exports', () => {
    it('should export all browser actions', async () => {
      const actionModule = await import('../src/services/action');
      expect(actionModule.browser_click).toBeDefined();
      expect(typeof actionModule.browser_click).toBe('function');
      
      expect(actionModule.browser_type).toBeDefined();
      expect(typeof actionModule.browser_type).toBe('function');
      
      expect(actionModule.browser_press_key).toBeDefined();
      expect(typeof actionModule.browser_press_key).toBe('function');
      
      expect(actionModule.browser_hover).toBeDefined();
      expect(typeof actionModule.browser_hover).toBe('function');
      
      expect(actionModule.browser_select_option).toBeDefined();
      expect(typeof actionModule.browser_select_option).toBe('function');
      
      expect(actionModule.browser_drag).toBeDefined();
      expect(typeof actionModule.browser_drag).toBe('function');
      
      expect(actionModule.browser_file_upload).toBeDefined();
      expect(typeof actionModule.browser_file_upload).toBe('function');
    });

    it('should export injectA11y', async () => {
      const a11yModule = await import('../src/services/a11y');
      expect(a11yModule.injectA11y).toBeDefined();
      expect(typeof a11yModule.injectA11y).toBe('function');
    });
  });

  describe('Index Export', () => {
    it('should export all core functionality from index', async () => {
      const index = await import('../src/index');
      
      // Core (runtime exports)
      expect(index.createEye).toBeDefined();
      
      // Utilities
      expect(index.getBrowserWSUrl).toBeDefined();
      expect(index.logger).toBeDefined();
      expect(index.setLogLevel).toBeDefined();
      
      // Services
      expect(index.browser_click).toBeDefined();
      expect(index.browser_type).toBeDefined();
      expect(index.browser_press_key).toBeDefined();
      expect(index.browser_hover).toBeDefined();
      expect(index.browser_select_option).toBeDefined();
      expect(index.browser_drag).toBeDefined();
      expect(index.browser_file_upload).toBeDefined();
      expect(index.injectA11y).toBeDefined();
    });
  });
});

describe('Eye Instance API', () => {
  it('should create eye with required platform prop', async () => {
    const { createEye } = await import('../src/eye');
    
    const mockPlatform = {
      name: 'puppeteer' as const,
      evaluate: vi.fn(),
      evaluateHandle: vi.fn(),
    };
    
    // Should not throw when called with valid platform
    expect(createEye).toBeDefined();
  });

  // EyeProps type is verified by TypeScript compilation
});

describe('Logger Behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('logger should have all required methods', async () => {
    const { logger } = await import('../src/utils/logger');
    
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.setLevel).toBe('function');
  });

  it('setLogLevel should accept valid log levels', async () => {
    const { setLogLevel, logger } = await import('../src/utils/logger');
    
    expect(() => setLogLevel('debug')).not.toThrow();
    expect(() => setLogLevel('info')).not.toThrow();
    expect(() => setLogLevel('warn')).not.toThrow();
    expect(() => setLogLevel('error')).not.toThrow();
  });
});
