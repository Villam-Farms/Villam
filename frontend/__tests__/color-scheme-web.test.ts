const mockUseState = jest.fn();
const mockUseEffect = jest.fn();
const mockUseRNColorScheme = jest.fn();

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useState: (...args: unknown[]) => mockUseState(...args),
  useEffect: (...args: unknown[]) => mockUseEffect(...args),
}));
jest.mock("react-native", () => ({ useColorScheme: () => mockUseRNColorScheme() }));

import { useColorScheme } from "@/hooks/use-color-scheme.web";

describe("web color scheme hydration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRNColorScheme.mockReturnValue("dark");
  });

  it("uses light during static rendering and schedules hydration", () => {
    const setHydrated = jest.fn();
    mockUseState.mockReturnValue([false, setHydrated]);
    expect(useColorScheme()).toBe("light");
    expect(mockUseState).toHaveBeenCalledWith(false);
    const effect = mockUseEffect.mock.calls[0][0];
    effect();
    expect(setHydrated).toHaveBeenCalledWith(true);
  });

  it.each(["dark", "light", null])("returns the native %s scheme after hydration", (scheme) => {
    mockUseState.mockReturnValue([true, jest.fn()]);
    mockUseRNColorScheme.mockReturnValue(scheme);
    expect(useColorScheme()).toBe(scheme);
  });
});
