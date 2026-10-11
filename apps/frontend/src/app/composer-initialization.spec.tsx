import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from '../components/composer/composer';
import { useLaunchStore } from '../components/composer/store';
import { ExistingDataContextProvider } from '../components/launches/helpers/use.existing.data';

vi.mock('@postmill-ai/frontend/components/layout/set.timezone', () => ({ newDayjs: () => null }));
vi.mock('@postmill-ai/helpers/utils/custom.fetch', () => ({ useFetch: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@postmill-ai/frontend/components/layout/loading', () => ({ LoadingComponent: () => <div>Loading</div> }));
vi.mock('@postmill-ai/frontend/components/composer/manage.modal', () => ({ ManageModal: () => <div>Ready</div> }));

const channel = { id: 'facebook', name: 'Tevel', identifier: 'facebook' } as any;
const data = { integration: channel.id, settings: {}, posts: [{ id: 'post', content: 'Test', delay: 0, image: [] }] };
const view = (value = data) => <ExistingDataContextProvider value={value}><Composer integrations={[channel]} allIntegrations={[channel]} /></ExistingDataContextProvider>;

beforeEach(() => useLaunchStore.getState().reset());
afterEach(cleanup);
describe('existing post initialization', () => {
  it('loads its content after selecting the matching channel', () => {
    render(view());
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(useLaunchStore.getState().internal[0].integration.id).toBe(channel.id);
  });
  it('preserves the selection when post data is refreshed', () => {
    const mounted = render(view());
    mounted.rerender(view({ ...data }));
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(useLaunchStore.getState().internal[0].integration.id).toBe(channel.id);
    expect(useLaunchStore.getState().internal[0].integrationValue).toHaveLength(1);
    mounted.unmount();
    expect(useLaunchStore.getState().selectedIntegrations).toHaveLength(0);
  });
});
