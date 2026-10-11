import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const mocks = vi.hoisted(() => ({ swr: vi.fn(), fetch: vi.fn(), reloadPost: vi.fn(), reloadChannels: vi.fn() }));
vi.mock('swr', () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'group' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@postmill-ai/helpers/utils/custom.fetch', () => ({ useFetch: () => mocks.fetch }));
vi.mock('@postmill-ai/react/translation/get.transation.service.client', () => ({ useT: () => (_key: string, fallback: string) => fallback }));
vi.mock('@postmill-ai/frontend/components/composer/composer', () => ({ Composer: () => <div data-testid="composer" /> }));
vi.mock('@postmill-ai/frontend/components/layout/loading', () => ({ LoadingComponent: () => <div data-testid="loading" /> }));

import EditPostPage from './page';

const post = { integration: 'channel', posts: [{ publishDate: '2026-10-11T12:00:00Z' }] };
let postState: Record<string, unknown>;
let channelState: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  postState = { data: post, mutate: mocks.reloadPost };
  channelState = { data: [{ id: 'channel' }], mutate: mocks.reloadChannels };
  mocks.swr.mockImplementation((key: string) => key === '/integrations/list' ? channelState : postState);
});

describe('EditPostPage', () => {
  it('shows a retry action for a failed request, without opening the composer', () => {
    postState.error = new Error('503');
    render(<EditPostPage />);
    expect(screen.getByText('Could not load post details')).toBeTruthy();
    expect(screen.queryByTestId('composer')).toBeNull();
    fireEvent.click(screen.getByText('Try again'));
    expect(mocks.reloadPost).toHaveBeenCalledOnce();
    expect(mocks.reloadChannels).toHaveBeenCalledOnce();
  });

  it('handles an empty group as a missing post', () => {
    postState.data = { ...post, posts: [] };
    render(<EditPostPage />);
    expect(screen.getByText('Post not found')).toBeTruthy();
  });

  it('handles a disconnected post channel even when other channels exist', () => {
    channelState.data = [{ id: 'other-channel' }];
    render(<EditPostPage />);
    expect(screen.getByText('This account is disconnected. Connect it again.')).toBeTruthy();
    expect(screen.queryByTestId('composer')).toBeNull();
  });

  it('opens the composer when the post and its channel are available', () => {
    render(<EditPostPage />);
    expect(screen.getByTestId('composer')).toBeTruthy();
  });

  it('rejects unsuccessful responses rather than treating error JSON as post data', async () => {
    postState.error = new Error('503');
    render(<EditPostPage />);
    const loadPost = mocks.swr.mock.calls.find(([key]) => key === '/posts/group/group')![1];
    mocks.fetch.mockResolvedValue(new Response('{"message":"Unavailable"}', { status: 503 }));
    await expect(loadPost('/posts/group/group')).rejects.toThrow('Could not load post (503)');
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(loadPost('/posts/group/group')).resolves.toBeNull();
  });
});
