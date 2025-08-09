import { describe, it, expect, vi } from 'vitest';
import { AsyncHarProcessor } from './AsyncHarProcessor';
// Mock HAR data for a simple login flow
const mockHar = {
  log: {
    entries: [
      { // GET the login page
        request: { url: 'https://example.com/login', method: 'GET', headers: [], cookies: [], postData: undefined },
        response: { status: 200, content: { text: '<form><input name="csrf_token" value="abc123xyz"></form>', mimeType: 'text/html' }, headers: [], cookies: [], redirectURL: '' },
        startedDateTime: new Date().toISOString(),
        time: 100,
      },
      { // POST the login credentials
        request: { url: 'https://example.com/login', method: 'POST', headers: [], cookies: [], postData: { text: 'username=test&password=test&csrf_token=abc123xyz', mimeType: 'application/x-www-form-urlencoded' } },
        response: { status: 302, content: { text: '', mimeType: 'text/html' }, headers: [{ name: 'set-cookie', value: 'sessionid=12345' }], cookies: [], redirectURL: 'https://example.com/dashboard' },
        startedDateTime: new Date(Date.now() + 1000).toISOString(),
        time: 100,
      },
      { // GET the dashboard (after successful login)
        request: { url: 'https://example.com/dashboard', method: 'GET', headers: [], cookies: [{ name: 'sessionid', value: '12345' }], postData: undefined },
        response: { status: 200, content: { text: 'Welcome!', mimeType: 'text/html' }, headers: [], cookies: [], redirectURL: '' },
        startedDateTime: new Date(Date.now() + 2000).toISOString(),
        time: 100,
      }
    ]
  }
};

// Mock browser-specific APIs for Node.js environment
const mockFileReader = {
  result: JSON.stringify(mockHar),
  onload: () => {},
  readAsText: () => {
    mockFileReader.onload();
  }
};
global.FileReader = vi.fn(() => mockFileReader) as any;


describe('AsyncHarProcessor', () => {
  it('should process a HAR file and return a valid LoliCode configuration', async () => {
    const harFile = { name: 'Test.har' }; // The content is provided by the mock FileReader

    const processor = new AsyncHarProcessor(harFile as any);

    // Mock the event handlers
    const onComplete = vi.fn();
    const onError = vi.fn();
    processor.on('onComplete', onComplete);
    processor.on('onError', onError);

    // Process the file
    await processor.process();

    // Check that onComplete was called and onError was not
    if (onError.mock.calls.length > 0) {
      // Log the error for debugging
      console.error('Test failed with error:', onError.mock.calls[0][0]);
    }
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();

    // Check the result
    const result = onComplete.mock.calls[0][0];
    expect(result).toBeDefined();
    expect(typeof result.loliCode).toBe('string');
    expect(result.loliCode.length).toBeGreaterThan(0);
    expect(result.blocks).toBeDefined();
    expect(result.variables).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalRequests).toBeGreaterThan(0);
    expect(result.metrics.criticalRequests).toBeGreaterThan(0);
  });
});
