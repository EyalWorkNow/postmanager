import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';

vi.mock('@postmill-ai/react/translation/get.transation.service.client', () => ({
  useT:
    () =>
    (_k: string, d: string, vars?: Record<string, unknown>) =>
      vars ? d.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars[k])) : d,
}));

const mockFetch = vi.fn();
vi.mock('@postmill-ai/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));

const mockToast = vi.fn();
vi.mock('@postmill-ai/react/toaster/toaster', () => ({
  useToaster: () => ({ show: mockToast }),
}));

vi.mock('@postmill-ai/frontend/components/settings/vpn/hooks/useVpnConfig', () => ({
  useVpnConfig: () => ({ data: undefined }),
}));

vi.mock(
  '@postmill-ai/frontend/components/settings/shared/provider-version-select',
  () => ({
    ProviderVersionSelect: () => null,
    useProviderVersionSelection: () => ({
      versions: [],
      selected: undefined,
      selectVersion: vi.fn(),
    }),
  })
);

vi.mock(
  '@postmill-ai/frontend/components/campaigns/selector/campaign-selector',
  () => ({
    CampaignSelector: () => null,
  })
);

vi.mock('@postmill-ai/frontend/components/launches/web3/web3.list', () => ({
  web3List: [
    {
      identifier: 'telegram',
      component: (props: {
        nonce: string;
        onComplete?: (code: string | number, state: string) => void;
      }) => (
        <div data-testid="web3-connect" data-nonce={props.nonce}>
          {/* Telegram hands back a NUMERIC chat id — the modal must coerce. */}
          <button
            data-testid="web3-complete"
            onClick={() => props.onComplete?.(8861130977, props.nonce)}
          />
        </div>
      ),
    },
  ],
}));

import { ChannelConfigForm } from './channel-edit.modal';

const CREDENTIALS_WARNING =
  'Please enter a Client ID / API Key before enabling this provider.';

const OAUTH_SETUP = {
  authType: 'oauth2' as const,
  credentialFields: [
    { key: 'clientId', label: 'App ID' },
    { key: 'clientSecret', label: 'App Secret', secret: true },
  ],
  setupSteps: ['Create an app', 'Paste the keys'],
};

const EDIT_CONFIG = {
  id: 'cfg-1',
  name: 'My IG set',
  enabled: false,
  scopes: '',
  redirectUri: '',
  setupNotes: '',
  isConfigured: false,
};

function renderForm(
  platformConfigured: boolean,
  opts: { withSetup?: boolean; edit?: boolean; simple?: boolean; identifier?: string } = {}
) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    // Isolated SWR cache per render — the modal's /integrations/list fetch
    // must not see another test's cached response.
    <SWRConfig value={{ provider: () => new Map() }}>
      <ChannelConfigForm
        // instagram-standalone is a main network: it opens on the simple
        // one-button screen; these specs cover the technical form unless asked.
        startTechnical={!opts.simple}
        identifier={opts.identifier || 'instagram-standalone'}
        providerName="Instagram (Standalone)"
        platformConfigured={platformConfigured}
        setup={opts.withSetup ? OAUTH_SETUP : null}
        callbackUrl="https://app.postmill.ai/integrations/social/instagram-standalone"
        defaultScopes="instagram_business_basic, instagram_business_content_publish"
        config={opts.edit ? EDIT_CONFIG : undefined}
        onClose={onClose}
        onSaved={onSaved}
      />
    </SWRConfig>
  );
  return { ...utils, onClose, onSaved };
}

const TOKEN_SETUP = {
  authType: 'token' as const,
  credentialFields: [{ key: 'clientId', label: 'Bot Token', secret: true }],
  setupSteps: ['Create a bot', 'Paste the token'],
};

function renderTokenForm(
  identifier: 'telegram' | 'line',
  opts: { platformConfigured?: boolean; edit?: boolean } = {}
) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ChannelConfigForm
        identifier={identifier}
        providerName={identifier === 'telegram' ? 'Telegram' : 'LINE'}
        platformConfigured={opts.platformConfigured ?? true}
        setup={TOKEN_SETUP}
        config={
          opts.edit
            ? { ...EDIT_CONFIG, id: 'cfg-tok', isConfigured: true }
            : undefined
        }
        onClose={onClose}
        onSaved={onSaved}
      />
    </SWRConfig>
  );
  return { ...utils, onClose, onSaved };
}

describe('ChannelConfigForm enable switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('is hidden before setup (create mode)', () => {
    renderForm(true, { withSetup: true });
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('allows enabling without a Client ID when a platform app is configured', () => {
    renderForm(true, { edit: true });
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(mockToast).not.toHaveBeenCalledWith(CREDENTIALS_WARNING, 'warning');
  });

  it('blocks enabling without a Client ID when no platform app is configured', () => {
    renderForm(false, { edit: true });
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(mockToast).toHaveBeenCalledWith(CREDENTIALS_WARNING, 'warning');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('saves an enabled credential set without clientId when a platform app is configured', async () => {
    renderForm(true, { edit: true });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(
        mockFetch.mock.calls.some(([u]) => u === '/channels/config/cfg-1')
      ).toBe(true)
    );
    const saveCall = mockFetch.mock.calls.find(([u]) => u === '/channels/config/cfg-1');
    const body = JSON.parse((saveCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({ name: 'My IG set', enabled: true });
    expect(body.clientId).toBeUndefined();
    expect(mockToast).toHaveBeenCalledWith('Channel saved', 'success');
  });
});

describe('ChannelConfigForm layout modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  // instagram-standalone is a featured network: its plain-language guide
  // replaces the adapter's labels ("Instagram App ID", "Return address …").
  it('platform-app mode collapses setup steps, callback and scopes under Advanced', () => {
    renderForm(true, { withSetup: true });
    expect(screen.queryByText('How to set this up')).toBeNull();
    expect(screen.queryByText(/Return address/)).toBeNull();
    expect(screen.queryByText("Permissions we'll request")).toBeNull();
    expect(screen.queryByText('Instagram App ID')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }));
    expect(screen.getByText('How to set this up')).toBeTruthy();
    expect(screen.getByText(/Return address/)).toBeTruthy();
    expect(screen.getByText("Permissions we'll request")).toBeTruthy();
    expect(screen.getByText('Instagram App ID')).toBeTruthy();
  });

  it('BYO mode leads with the guide, keys and return address; scopes go under Advanced', () => {
    renderForm(false, { withSetup: true });
    expect(screen.getByText('How to set this up')).toBeTruthy();
    expect(screen.getByText(/Return address/)).toBeTruthy();
    expect(screen.getByText('Instagram App ID')).toBeTruthy();
    expect(screen.getByText('Protected and local')).toBeTruthy();
    expect(screen.queryByText("Permissions we'll request")).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }));
    expect(screen.getByText("Permissions we'll request")).toBeTruthy();
  });
});

describe('ChannelConfigForm platform-app connect', () => {
  const openSpy = vi.fn();

  // The modal SWR-fetches /integrations/list on mount — key all mocks on URL
  // so the list call never consumes a sequenced mock.
  const mockConnectSequence = (
    social: { url?: string; err?: boolean },
    integrations: any[] = []
  ) =>
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations }) });
      }
      if (url === '/channels/config') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-1' }) });
      }
      if (url.startsWith('/integrations/social/')) {
        return Promise.resolve({
          ok: true,
          json: async () => (social.err ? { err: true } : { url: social.url }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = openSpy;
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    delete (window as { open?: unknown }).open;
  });

  it('shows the Connect button only for OAuth providers with a platform app', () => {
    const { unmount } = renderForm(true, { withSetup: true });
    const button = screen.getByRole('button', {
      name: 'Connect with Instagram (Standalone)',
    });
    expect(button.className).toContain('w-full');
    expect(button.className).toContain('whitespace-nowrap');
    unmount();

    // Own-app (BYO) sets connect from the form too, via "Save and connect".
    renderForm(false, { withSetup: true });
    expect(
      screen.queryByRole('button', { name: 'Connect with Instagram (Standalone)' })
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Save and connect to Instagram' })).toBeTruthy();
  });

  it('BYO "Save and connect" needs both keys, then saves the set enabled and opens OAuth', async () => {
    mockConnectSequence({ url: 'https://oauth.example/auth' });
    openSpy.mockReturnValue({ closed: false });
    renderForm(false, { withSetup: true });
    const connect = screen.getByRole('button', { name: 'Save and connect to Instagram' });

    fireEvent.click(connect);
    expect(mockToast).toHaveBeenCalledWith(
      'Fill in both app keys first (following the steps above).',
      'warning'
    );
    expect(mockFetch.mock.calls.some(([u]) => u === '/channels/config')).toBe(false);

    fireEvent.change(document.querySelector('input[name="cred_clientId_instagram-standalone"]')!, {
      target: { value: '123' },
    });
    fireEvent.change(document.querySelector('input[name="cred_clientSecret_instagram-standalone"]')!, {
      target: { value: 'secret' },
    });
    fireEvent.click(connect);
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    const create = mockFetch.mock.calls.find(([u]) => u === '/channels/config');
    expect(JSON.parse((create![1] as RequestInit).body as string)).toMatchObject({
      enabled: true,
      clientId: '123',
      clientSecret: 'secret',
    });
    expect(openSpy.mock.calls[0][0]).toBe('https://oauth.example/auth');
  });

  it('shows the connected channel and offers Connect another account', async () => {
    mockConnectSequence({}, [
      {
        identifier: 'instagram-standalone',
        name: 'Postmill',
        disabled: false,
        inBetweenSteps: false,
      },
    ]);
    renderForm(true, { withSetup: true, edit: true });
    expect(await screen.findByText('Connected as Postmill')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Connect another account' })
    ).toBeTruthy();
  });

  it('saves the set, then opens the OAuth url in a popup bound to that set', async () => {
    mockConnectSequence({ url: 'https://oauth.example/auth' });
    openSpy.mockReturnValue({ closed: false });

    renderForm(true, { withSetup: true });
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'My IG set' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with Instagram (Standalone)' })
    );

    await waitFor(() =>
      expect(
        mockFetch.mock.calls.some(([u]) => u === '/channels/config')
      ).toBe(true)
    );
    const createCall = mockFetch.mock.calls.find(([u]) => u === '/channels/config');
    // A set must not be enabled before it is set up — Connect creates it
    // disabled and enables it after a successful connect.
    expect(JSON.parse((createCall![1] as RequestInit).body as string)).toMatchObject({
      identifier: 'instagram-standalone',
      name: 'My IG set',
      enabled: false,
    });
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://oauth.example/auth',
        'postmill-oauth',
        'width=640,height=720,popup'
      )
    );
    expect(
      mockFetch.mock.calls.some(
        ([u]) => u === '/integrations/social/instagram-standalone?config=cfg-1'
      )
    ).toBe(true);
  });

  it('closes and refreshes when the popup posts postmill:channel-connected', async () => {
    mockConnectSequence({ url: 'https://oauth.example/auth' });
    openSpy.mockReturnValue({ closed: false });

    const { onClose, onSaved } = renderForm(true, { withSetup: true });
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'My IG set' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with Instagram (Standalone)' })
    );
    await waitFor(() => expect(openSpy).toHaveBeenCalled());

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'postmill:channel-connected', provider: 'instagram-standalone' },
        origin: window.location.origin,
      })
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Channel Connected!', 'success');

    // A successful connect enables the now-set-up credential set.
    const enableCall = mockFetch.mock.calls.find(
      ([u, init]) =>
        u === '/channels/config/cfg-1' && (init as RequestInit)?.method === 'PUT'
    );
    expect(enableCall).toBeTruthy();
    expect(JSON.parse((enableCall![1] as RequestInit).body as string)).toEqual({
      enabled: true,
    });
  });

  it('ignores completion messages from a foreign origin', async () => {
    mockConnectSequence({ url: 'https://oauth.example/auth' });
    openSpy.mockReturnValue({ closed: false });

    const { onClose } = renderForm(true, { withSetup: true });
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'My IG set' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with Instagram (Standalone)' })
    );
    await waitFor(() => expect(openSpy).toHaveBeenCalled());

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'postmill:channel-connected', provider: 'instagram-standalone' },
        origin: 'https://evil.example',
      })
    );

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a persistent error instead of opening a popup when initiation returns err', async () => {
    mockConnectSequence({ err: true });

    renderForm(true, { withSetup: true });
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'My IG set' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with Instagram (Standalone)' })
    );

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Check the app settings and try again')
    );
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe('ChannelConfigForm token connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations: [] }) });
      }
      if (url === '/channels/config') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-tok' }) });
      }
      if (url.startsWith('/integrations/social/')) {
        return Promise.resolve({ ok: true, json: async () => ({ url: 'nonce-123' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('platform-app mode shows Connect and collapses the bot token under Advanced', () => {
    renderTokenForm('telegram');
    expect(
      screen.getByRole('button', { name: 'Connect with Telegram' })
    ).toBeTruthy();
    expect(screen.queryByText('Bot Token')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }));
    expect(screen.getByText('Bot Token')).toBeTruthy();
  });

  it('telegram: Connect renders the interactive connect view with the minted nonce', async () => {
    renderTokenForm('telegram');
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'TG set' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Telegram' }));

    const view = await screen.findByTestId('web3-connect');
    expect(view.getAttribute('data-nonce')).toBe('nonce-123');
    expect(
      mockFetch.mock.calls.some(
        ([u]) => u === '/integrations/social/telegram?config=cfg-tok'
      )
    ).toBe(true);
    // Back returns to the form.
    fireEvent.click(screen.getByText('Back'));
    expect(screen.queryByTestId('web3-connect')).toBeNull();
  });

  it('line (no interactive component): Connect completes the token-validation connect inline', async () => {
    const { onClose, onSaved } = renderTokenForm('line');
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'LINE set' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect with LINE' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Inline social-connect POST — no full-page redirect through
    // continue.integration (a failure there dumped the user on /posts).
    const call = mockFetch.mock.calls.find(
      ([u]) => u === '/integrations/social-connect/line'
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body)).toEqual({
      state: 'nonce-123',
      code: 'connect',
      timezone: expect.any(String),
    });
    // Success: the set is flipped enabled and the modal reports it.
    expect(
      mockFetch.mock.calls.some(
        ([u, o]) =>
          u === '/channels/config/cfg-tok' &&
          o?.method === 'PUT' &&
          JSON.parse(o.body).enabled === true
      )
    ).toBe(true);
    expect(onSaved).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Channel Connected!', 'success');
    expect(screen.queryByTestId('web3-connect')).toBeNull();
  });

  it('telegram: completing the interactive connect posts to social-connect inline', async () => {
    const { onClose, onSaved } = renderTokenForm('telegram');
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'TG set' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Telegram' }));
    fireEvent.click(await screen.findByTestId('web3-complete'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const call = mockFetch.mock.calls.find(
      ([u]) => u === '/integrations/social-connect/telegram'
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body)).toEqual({
      state: 'nonce-123',
      // Numeric chat id from the connect component is coerced to a string
      // (ConnectIntegrationDto rejects non-string codes with a 400).
      code: '8861130977',
      timezone: expect.any(String),
    });
    expect(onSaved).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Channel Connected!', 'success');
  });

  it('telegram: expired state returns to the form with a retry message (no page dump)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations: [] }) });
      }
      if (url === '/channels/config') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-tok' }) });
      }
      if (url.startsWith('/integrations/social-connect/')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ message: 'Invalid or expired state' }),
        });
      }
      if (url.startsWith('/integrations/social/')) {
        return Promise.resolve({ ok: true, json: async () => ({ url: 'nonce-123' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderTokenForm('telegram');
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'TG set' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Telegram' }));
    fireEvent.click(await screen.findByTestId('web3-complete'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        'Connect session expired — please try again',
        'warning'
      )
    );
    // Back on the form: the next Connect click mints a fresh state.
    expect(screen.queryByTestId('web3-connect')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Connect with Telegram' })
    ).toBeTruthy();
  });

  it('failed connect retry updates the same set instead of POSTing a duplicate (409)', async () => {
    let connectCalls = 0;
    mockFetch.mockImplementation((url: string, opts?: any) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations: [] }) });
      }
      if (url === '/channels/config' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-tok' }) });
      }
      if (url === '/channels/config/cfg-tok' && opts?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      if (url.startsWith('/integrations/social-connect/')) {
        connectCalls += 1;
        return connectCalls === 1
          ? Promise.resolve({ ok: false, json: async () => ({ message: 'LINE channel access token was rejected' }) })
          : Promise.resolve({ ok: true, json: async () => ({ id: 'int-1' }) });
      }
      if (url.startsWith('/integrations/social/')) {
        return Promise.resolve({ ok: true, json: async () => ({ url: 'nonce-123' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { onClose } = renderTokenForm('line');
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Marketing LinkedIn'),
      { target: { value: 'LINE set' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect with LINE' }));
    // First connect fails — the modal stays open on the form.
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        'LINE channel access token was rejected',
        'warning'
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect with LINE' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    // Retry saved via PUT on the created set — no duplicate POST.
    expect(
      mockFetch.mock.calls.some(
        ([u, o]) => u === '/channels/config/cfg-tok' && o?.method === 'PUT'
      )
    ).toBe(true);
    expect(
      mockFetch.mock.calls.filter(
        ([u, o]) => u === '/channels/config' && o?.method === 'POST'
      )
    ).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith('Channel Connected!', 'success');
  });
});

const DIRECT_SETUP = {
  authType: 'direct' as const,
  credentialFields: [],
  setupSteps: ['Create an app password', 'Enter your handle'],
};

const DIRECT_CUSTOM_FIELDS = [
  {
    key: 'service',
    label: 'Service',
    defaultValue: 'https://bsky.social',
    validation: '/^https?:\\/\\/.+$/',
    type: 'text' as const,
  },
  { key: 'identifier', label: 'Identifier', validation: '/^.+$/', type: 'text' as const },
  { key: 'password', label: 'Password', validation: '/^.{3,}$/', type: 'password' as const },
];

function renderDirectForm() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ChannelConfigForm
        identifier="bluesky"
        providerName="Bluesky"
        platformConfigured={false}
        setup={DIRECT_SETUP}
        customFields={DIRECT_CUSTOM_FIELDS}
        onClose={onClose}
        onSaved={onSaved}
      />
    </SWRConfig>
  );
  return { ...utils, onClose, onSaved };
}

describe('ChannelConfigForm direct connect (customFields)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations: [] }) });
      }
      if (url === '/channels/config') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-bsky' }) });
      }
      if (url.startsWith('/integrations/social/')) {
        return Promise.resolve({ ok: true, json: async () => ({ url: 'nonce-bsky' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders the account-credential fields and Connect button', () => {
    renderDirectForm();
    expect(screen.getByText('Identifier')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Connect with Bluesky' })
    ).toBeTruthy();
  });

  it('rejects invalid field values before saving', () => {
    renderDirectForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. Marketing LinkedIn'), {
      target: { value: 'Bluesky set' },
    });
    // Identifier empty — fails its /^.+$/ validation.
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Bluesky' }));
    expect(mockToast).toHaveBeenCalledWith('Identifier is invalid', 'warning');
    expect(
      mockFetch.mock.calls.some(([u]) => u === '/channels/config')
    ).toBe(false);
  });

  it('saves the set ENABLED, then completes the connect inline with base64(JSON) code', async () => {
    const { onClose, onSaved } = renderDirectForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. Marketing LinkedIn'), {
      target: { value: 'Bluesky set' },
    });
    fireEvent.change(screen.getByDisplayValue('https://bsky.social'), {
      target: { value: 'https://bsky.social' },
    });
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: 'postmill.bsky.social' } });
    fireEvent.change(inputs[1], { target: { value: 'app-password-x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Bluesky' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Direct sets enable up front: connect initiation is gated on an enabled
    // set, and direct sets hold no app credentials to wait for.
    const createCall = mockFetch.mock.calls.find(([u]) => u === '/channels/config');
    expect(JSON.parse(createCall![1].body).enabled).toBe(true);
    // State minted against the saved set.
    expect(
      mockFetch.mock.calls.some(
        ([u]) => u === '/integrations/social/bluesky?config=cfg-bsky'
      )
    ).toBe(true);
    // Inline social-connect POST — code is base64(JSON) of the field values,
    // the same payload the old composer connect flow posted.
    const connectCall = mockFetch.mock.calls.find(
      ([u]) => u === '/integrations/social-connect/bluesky'
    );
    expect(connectCall).toBeTruthy();
    const body = JSON.parse(connectCall![1].body);
    expect(body.state).toBe('nonce-bsky');
    expect(JSON.parse(atob(body.code))).toEqual({
      service: 'https://bsky.social',
      identifier: 'postmill.bsky.social',
      password: 'app-password-x',
    });
    expect(onSaved).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Channel Connected!', 'success');
  });
});

describe('ChannelConfigForm — shared /integrations/list SWR key contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('populates the shared SWR cache with a BARE ARRAY, not the raw envelope', async () => {
    // Regression (POSTMILL-APP-E/K): this fetcher used to resolve to the raw
    // `{integrations: [...]}` envelope. `/integrations/list` is a shared SWR
    // key — dashboard/analytics then read the envelope from the cache and
    // crashed on `.map is not a function`.
    const cache = new Map();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            integrations: [
              { identifier: 'instagram-standalone', name: 'IG', disabled: false },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <SWRConfig value={{ provider: () => cache }}>
        <ChannelConfigForm
          startTechnical
          identifier="instagram-standalone"
          providerName="Instagram (Standalone)"
          platformConfigured={true}
          setup={OAUTH_SETUP}
          callbackUrl="https://app.postmill.ai/integrations/social/instagram-standalone"
          defaultScopes="instagram_business_basic"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </SWRConfig>
    );

    await waitFor(() => {
      const cached = cache.get('/integrations/list');
      expect(cached).toBeDefined();
      expect(Array.isArray(cached.data)).toBe(true);
      expect(cached.data[0].name).toBe('IG');
    });
  });
});

describe('ChannelConfigForm simple mode (main networks)', () => {
  const openSpy = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = openSpy;
    mockFetch.mockImplementation((url: string) => {
      if (url === '/integrations/list') {
        return Promise.resolve({ ok: true, json: async () => ({ integrations: [] }) });
      }
      if (url === '/channels/config') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-1' }) });
      }
      if (url.startsWith('/integrations/social/')) {
        return Promise.resolve({ ok: true, json: async () => ({ url: 'https://oauth.example/auth' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });
  afterEach(() => {
    delete (window as { open?: unknown }).open;
  });

  it('with a ready app shows one big connect button and no developer fields', async () => {
    openSpy.mockReturnValue({ closed: false });
    renderForm(true, { withSetup: true, simple: true });
    expect(screen.queryByText('Instagram App ID')).toBeNull();
    expect(screen.queryByText(/Return address/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Instagram' }));
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(openSpy.mock.calls[0][0]).toBe('https://oauth.example/auth');
  });

  it('without an app opens guided setup in the same form', () => {
    renderForm(false, { withSetup: true, simple: true });
    expect(screen.getByText('Set up Instagram once, then connect')).toBeTruthy();
    expect(screen.getByText(/This connection does not require a Facebook Page/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect with Instagram' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));
    expect(screen.getByText('Instagram App ID')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Meta for Developers/ }).getAttribute('href')).toBe('https://developers.facebook.com/apps');
    fireEvent.click(screen.getByRole('button', { name: 'Back to the simple screen' }));
    expect(screen.getByRole('button', { name: 'Start guided setup' })).toBeTruthy();
  });

  it.each([
    ['facebook', 'Personal Facebook profiles cannot be connected'],
    ['instagram', 'linked to a Facebook Page you manage'],
  ])('explains the account requirement for %s before setup', (identifier, requirement) => {
    renderForm(false, { withSetup: true, simple: true, identifier });
    expect(screen.getByText(new RegExp(requirement))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start guided setup' })).toBeTruthy();
  });

  it('keeps a save failure visible without starting OAuth', async () => {
    mockFetch.mockImplementation((url: string) => Promise.resolve({
      ok: url !== '/channels/config',
      json: async () => ({ integrations: [] }),
    }));
    renderForm(true, { withSetup: true, simple: true });
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Instagram' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not save the connection settings'));
    expect(openSpy).not.toHaveBeenCalled();
    expect(mockFetch.mock.calls.some(([url]) => url.startsWith('/integrations/social/'))).toBe(false);
  });

  it('keeps connection failures visible and lets the user retry the saved set', async () => {
    openSpy.mockReturnValue({ closed: false });
    mockFetch.mockImplementation((url: string) => {
      if (url.startsWith('/integrations/social/')) return Promise.reject(new Error('Network unavailable'));
      return Promise.resolve({ ok: true, json: async () => ({ id: 'cfg-1', integrations: [] }) });
    });
    renderForm(true, { withSetup: true, simple: true });
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Instagram' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The server is temporarily unavailable'));
    expect(openSpy).not.toHaveBeenCalled();
    mockFetch.mockImplementation((url: string) => Promise.resolve({
      ok: true,
      json: async () => url.startsWith('/integrations/social/') ? { url: 'https://oauth.example/auth' } : { id: 'cfg-1' },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Instagram' }));
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('/channels/config/cfg-1', expect.objectContaining({ method: 'PUT' }));
  });

  it('shows an actionable error when the server rejects connection initiation', async () => {
    mockFetch.mockImplementation((url: string) => Promise.resolve({
      ok: !url.startsWith('/integrations/social/'),
      json: async () => ({ id: 'cfg-1', integrations: [] }),
    }));
    renderForm(true, { withSetup: true, simple: true });
    fireEvent.click(screen.getByRole('button', { name: 'Connect with Instagram' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Check the app settings and try again'));
    expect(openSpy).not.toHaveBeenCalled();
  });
});
