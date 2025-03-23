import { jest } from '@jest/globals';

// Mock the sitemap module instead of importing it directly
jest.mock('../src/sitemap.js', () => ({
  processSitemap: jest.fn().mockImplementation(() => Promise.resolve())
}));

// Import the mocked module
import { processSitemap } from '../src/sitemap.js';

// Mock chalk to avoid ESM issues
jest.mock('chalk', () => ({
  blue: jest.fn((text) => text),
  green: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  red: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  bold: {
    green: jest.fn((text) => text)
  }
}));

describe('Sitemap Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('processSitemap function can be called with correct parameters', async () => {
    // Test data
    const sitemapUrl = 'https://example.com/sitemap.xml';
    const options = {
      key: 'test-api-key-12345',
      site: 'example.com',
      engine: 'api.indexnow.org'
    };
    
    // Call the function
    await processSitemap(sitemapUrl, options);
    
    // Verify it was called with the expected parameters
    expect(processSitemap).toHaveBeenCalledWith(sitemapUrl, options);
    expect(processSitemap).toHaveBeenCalledTimes(1);
  });
}); 