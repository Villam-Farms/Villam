const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

function loadApi({ os = 'ios', constants = {}, env }: { os?: string; constants?: any; env?: string } = {}) {
  jest.resetModules();
  if (env === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = env;
  jest.doMock('expo-constants', () => ({ __esModule: true, default: constants }));
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  return require('@/lib/api') as typeof import('@/lib/api');
}

describe('API base URL discovery', () => {
  afterAll(() => {
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('normalizes an environment URL', () => {
    expect(loadApi({ env: ' https://api.example.test/// ' }).apiBaseUrl).toBe('https://api.example.test');
  });

  it('uses Expo extra configuration', () => {
    expect(loadApi({ constants: { expoConfig: { extra: { apiUrl: ' https://extra.test/ ' } } } }).apiBaseUrl).toBe('https://extra.test');
  });

  it.each([
    [{ expoConfig: { hostUri: '192.168.1.8:8081' } }, 'http://192.168.1.8:8001'],
    [{ manifest2: { extra: { expoClient: { hostUri: '10.1.2.3:8081' } } } }, 'http://10.1.2.3:8001'],
    [{ manifest: { hostUri: '172.16.0.2:8081' } }, 'http://172.16.0.2:8001'],
  ])('discovers the development host', (constants, expected) => {
    expect(loadApi({ constants }).apiBaseUrl).toBe(expected);
  });

  it('uses emulator fallbacks when Expo has no host', () => {
    expect(loadApi({ os: 'android' }).apiBaseUrl).toBe('http://10.0.2.2:8001');
    expect(loadApi({ os: 'ios' }).apiBaseUrl).toBe('http://localhost:8001');
  });
});
