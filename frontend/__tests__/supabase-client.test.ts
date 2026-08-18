const mockCreateClient = jest.fn();

async function loadClient(os: 'ios' | 'web', withWindow = false) {
  jest.resetModules();
  mockCreateClient.mockReset();
  mockCreateClient.mockReturnValue({ client: true });
  jest.doMock('react-native-url-polyfill/auto', () => ({}));
  jest.doMock('@supabase/supabase-js', () => ({ createClient: (...args: any[]) => mockCreateClient(...args) }));
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  if (withWindow) {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } } });
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
  return require('@/lib/supabase');
}

describe('Supabase client configuration', () => {
  afterEach(() => Reflect.deleteProperty(globalThis, 'window'));

  it('uses native storage and clears both auth keys', async () => {
    const module = await loadClient('ios');
    expect(mockCreateClient).toHaveBeenCalledWith('https://example.supabase.co', 'test-anon-key', expect.objectContaining({ auth: expect.objectContaining({ detectSessionInUrl: false, flowType: 'pkce' }) }));
    const remove = jest.spyOn(mockCreateClient.mock.calls[0][2].auth.storage, 'removeItem');
    await module.clearLocalAuthSession();
    expect(remove).toHaveBeenCalledWith('villam-auth');
    expect(remove).toHaveBeenCalledWith('villam-auth-code-verifier');
  });

  it('uses browser localStorage on web', async () => {
    const module = await loadClient('web', true);
    const options = mockCreateClient.mock.calls[0][2];
    await options.auth.storage.setItem('key', 'value');
    await options.auth.storage.getItem('key');
    await module.clearLocalAuthSession();
    expect(window.localStorage.setItem).toHaveBeenCalledWith('key', 'value');
    expect(window.localStorage.getItem).toHaveBeenCalledWith('key');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('villam-auth');
    expect(options.auth.detectSessionInUrl).toBe(true);
  });

  it('falls back to memory storage for server-side web rendering', async () => {
    const module = await loadClient('web');
    const storage = mockCreateClient.mock.calls[0][2].auth.storage;
    await storage.setItem('key', 'value');
    await expect(storage.getItem('key')).resolves.toBe('value');
    await storage.removeItem('key');
    await expect(storage.getItem('key')).resolves.toBeNull();
    await module.clearLocalAuthSession();
  });
});
