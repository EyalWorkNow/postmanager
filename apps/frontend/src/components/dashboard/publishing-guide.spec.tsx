import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublishingGuide } from './publishing-guide';

vi.mock('@postmill-ai/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, fallback: string) => fallback,
}));

afterEach(cleanup);

describe('PublishingGuide', () => {
  it('shows the connection action until a channel actually exists', () => {
    const { rerender } = render(<PublishingGuide connected={undefined} canConnect canCreate canReadPosts />);
    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.getByRole('link', { name: /Connect my account/ }).getAttribute('href')).toBe('/settings/channels');
    rerender(<PublishingGuide connected canConnect canCreate canReadPosts />);
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Create a post/ }).getAttribute('href')).toBe('/posts/post');
  });

  it('does not offer write actions to a reader', () => {
    render(<PublishingGuide connected canConnect={false} canCreate={false} canReadPosts />);
    expect(screen.queryByRole('link', { name: /View accounts/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Create a post/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Open my calendar/ }).getAttribute('href')).toBe('/posts');
  });
});
