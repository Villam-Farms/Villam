import React from 'react';
import { Alert, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockUnits = jest.fn();
const mockQuantities = jest.fn();
let mockId: string | string[] | undefined = 'new';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockId }),
  router: { back: (...args: any[]) => mockBack(...args), replace: (...args: any[]) => mockReplace(...args) },
  Stack: {
    Screen: ({ options }: any) => {
      const MockView = require('react-native').View;
      return <MockView>{options.headerLeft?.()}{options.headerRight?.()}</MockView>;
    },
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: { background: 'white', border: { default: 'gray' }, text: { primary: 'black', secondary: 'gray', tertiary: 'silver' }, input: { background: '#eee' } } }),
}));
jest.mock('@/lib/grocery-list-preferences', () => ({
  getShowGroceryListUnits: (...args: any[]) => mockUnits(...args),
  getShowGroceryListQuantities: (...args: any[]) => mockQuantities(...args),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: (...args: any[]) => mockGetUser(...args) }, from: (...args: any[]) => mockFrom(...args) },
}));

import GroceryListDetailScreen from '@/app/grocery-list/[id]';

const alert = jest.spyOn(Alert, 'alert');
const user = { id: 'u1' };

function successfulExistingQueries() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'grocery_lists') {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'l1', title: 'Weekly', created_at: '2026-08-01', source_recipe_id: null }, error: null }) }) }) }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      };
    }
    return {
      select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'i1', list_id: 'l1', user_id: 'u1', position: 0, quantity: '2', unit: 'lb', name: 'Apples', is_checked: false, created_at: '' }], error: null }) }) }) }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      insert: async () => ({ error: null }),
    };
  });
}

describe('grocery list detail', () => {
  afterEach(async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockId = 'new';
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    mockUnits.mockResolvedValue(true);
    mockQuantities.mockResolvedValue(true);
    successfulExistingQueries();
  });

  it('shows an invalid-list state', async () => {
    mockId = undefined;
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByText('List not found')).toBeTruthy());
  });

  it('honors hidden quantity and unit preferences', async () => {
    mockUnits.mockResolvedValue(false);
    mockQuantities.mockResolvedValue(false);
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByText('Add item')).toBeTruthy());
    await fireEvent.press(screen.getByText('Add item'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 130)); });
    expect(screen.queryByPlaceholderText('1')).toBeNull();
    expect(screen.queryByPlaceholderText('unit')).toBeNull();
  });

  it.each([
    ['authentication errors', async () => mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth') })],
    ['signed-out users', async () => mockGetUser.mockResolvedValue({ data: { user: null }, error: null })],
  ])('handles %s while loading', async (_label, configure) => {
    mockId = 'l1';
    await configure();
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByText('List not found')).toBeTruthy());
  });

  it('handles missing list rows and item query failures', async () => {
    mockId = 'l1';
    mockFrom.mockImplementation((table: string) => table === 'grocery_lists' ? {
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('missing') }) }) }) }),
    } : {});
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByText('List not found')).toBeTruthy());
  });

  it('handles grocery item query failures', async () => {
    mockId = 'l1';
    mockFrom.mockImplementation((table: string) => table === 'grocery_lists' ? {
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'l1', title: 'List', created_at: null, source_recipe_id: null }, error: null }) }) }) }),
    } : { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: null, error: new Error('items') }) }) }) }) });
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByText('List not found')).toBeTruthy());
  });

  it('creates a list, edits items, and navigates to it', async () => {
    mockFrom.mockImplementation((table: string) => table === 'grocery_lists' ? {
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'created', created_at: '2026-08-17' }, error: null }) }) }),
    } : { insert: async () => ({ error: null }) });
    const screen = await render(<GroceryListDetailScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Title...'), ' Weekend ');
    await fireEvent.press(screen.getByText('Add item'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 130)); });
    const name = await screen.findByPlaceholderText('Item name');
    await fireEvent.changeText(name, ' Tomatoes ');
    await fireEvent.changeText(screen.getByPlaceholderText('1'), ' 3 ');
    await fireEvent.changeText(screen.getByPlaceholderText('unit'), ' lb ');
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/grocery-list/created'));
    expect(alert).toHaveBeenCalledWith('Saved', 'Your grocery list was created.');
  });

  it('loads, checks, removes, and updates an existing list', async () => {
    mockId = ['l1'];
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Weekly')).toBeTruthy());
    expect(screen.getByDisplayValue('Apples')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Check Apples'));
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Saved', 'Your grocery list was updated.'));
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('adds and removes editable rows', async () => {
    const screen = await render(<GroceryListDetailScreen />);
    await fireEvent.press(screen.getByText('Add item'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 130)); });
    await fireEvent.changeText(screen.getByPlaceholderText('Item name'), 'Milk');
    await fireEvent.press(screen.getByText('Add item'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 130)); });
    await fireEvent.changeText(screen.getAllByPlaceholderText('Item name')[1], 'Bread');
    await fireEvent.press(screen.getByLabelText('Remove Milk'));
    expect(screen.queryByDisplayValue('Milk')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Remove Bread'));
    expect(screen.getByText(/No items yet/)).toBeTruthy();
  });

  it('reports create-list and item-insertion failures', async () => {
    mockFrom.mockImplementation((table: string) => table === 'grocery_lists' ? {
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('create failed') }) }) }),
    } : { insert: async () => ({ error: new Error('items failed') }) });
    const screen = await render(<GroceryListDetailScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Title...'), 'List');
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Save failed', 'create failed'));
  });

  it.each(['update', 'delete-items', 'insert-items'])('reports %s failures while updating', async (stage) => {
    mockId = 'l1';
    mockFrom.mockImplementation((table: string) => {
      if (table === 'grocery_lists') return {
        select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'l1', title: 'Weekly', created_at: 'bad-date', source_recipe_id: null }, error: null }) }) }) }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: stage === 'update' ? new Error(stage) : null }) }) }),
      };
      return {
        select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'i', list_id: 'l1', user_id: 'u1', position: 0, quantity: null, unit: null, name: 'Milk', is_checked: false, created_at: '' }], error: null }) }) }) }),
        delete: () => ({ eq: () => ({ eq: async () => ({ error: stage === 'delete-items' ? new Error(stage) : null }) }) }),
        insert: async () => ({ error: stage === 'insert-items' ? new Error(stage) : null }),
      };
    });
    const screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Weekly')).toBeTruthy());
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Save failed', stage));
  });

  it('reports save authentication errors', async () => {
    const screen = await render(<GroceryListDetailScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Title...'), 'List');
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth save') });
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Save failed', 'auth save'));
  });

  it('validates title and authentication', async () => {
    const screen = await render(<GroceryListDetailScreen />);
    await fireEvent.press(screen.getByText('Save'));
    expect(alert).toHaveBeenCalledWith('Title required', expect.any(String));
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await fireEvent.changeText(screen.getByPlaceholderText('Title...'), 'List');
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Not signed in', expect.any(String)));
  });

  it('deletes existing lists and backs out of new lists', async () => {
    let screen = await render(<GroceryListDetailScreen />);
    await fireEvent.press(screen.getByLabelText('Delete grocery list'));
    expect(mockBack).toHaveBeenCalled();
    screen.unmount();

    mockId = 'l1';
    screen = await render(<GroceryListDetailScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Weekly')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Delete grocery list'));
    const choices = alert.mock.calls.at(-1)?.[2] as any[];
    await act(async () => choices[1].onPress());
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/grocerylist');
  });

});
