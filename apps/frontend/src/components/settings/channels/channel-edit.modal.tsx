'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { Button } from '@postmill-ai/react/form/button';
import { Input } from '@postmill-ai/react/form/input';
import { useFetch } from '@postmill-ai/helpers/utils/custom.fetch';
import { createFetchError } from '@postmill-ai/frontend/components/settings/shared/fetch-error';
import { useToaster } from '@postmill-ai/react/toaster/toaster';
import { useT } from '@postmill-ai/react/translation/get.transation.service.client';
import { useVpnConfig } from '@postmill-ai/frontend/components/settings/vpn/hooks/useVpnConfig';
import { ChannelVpnRegionSelect } from './channel-vpn-region-select';
import { channelGuide, featuredChannels } from './featured-channels';
import { CampaignSelector } from '@postmill-ai/frontend/components/campaigns/selector/campaign-selector';
import {
  ProviderVersionSelect,
  useProviderVersionSelection,
} from '@postmill-ai/frontend/components/settings/shared/provider-version-select';
import { web3List } from '@postmill-ai/frontend/components/launches/web3/web3.list';

const PROVIDER_APP_LINKS: Record<string, { label: string; url: string | null }> = {
  linkedin: { label: 'LinkedIn Developer Portal', url: 'https://www.linkedin.com/developers/apps' },
  x: { label: 'X Developer Portal', url: 'https://developer.x.com/en/portal/dashboard' },
  facebook: { label: 'Facebook Developers', url: 'https://developers.facebook.com/apps' },
  instagram: { label: 'Instagram Basic Display', url: 'https://developers.facebook.com/docs/instagram-basic-display-api' },
  'instagram-standalone': { label: 'Instagram Basic Display', url: 'https://developers.facebook.com/docs/instagram-basic-display-api' },
  threads: { label: 'Threads Developer', url: 'https://developers.facebook.com/docs/threads' },
  youtube: { label: 'Google Cloud Console', url: 'https://console.cloud.google.com/apis/credentials' },
  tiktok: { label: 'TikTok for Developers', url: 'https://developers.tiktok.com/apps' },
  pinterest: { label: 'Pinterest Developers', url: 'https://developers.pinterest.com/apps' },
  discord: { label: 'Discord Developer Portal', url: 'https://discord.com/developers/applications' },
  slack: { label: 'Slack API', url: 'https://api.slack.com/apps' },
  reddit: { label: 'Reddit Apps', url: 'https://www.reddit.com/prefs/apps' },
  tumblr: { label: 'Tumblr OAuth Apps', url: 'https://www.tumblr.com/oauth/apps' },
  telegram: { label: 'Telegram BotFather', url: 'https://t.me/botfather' },
  wordpress: { label: 'WordPress Developers', url: 'https://developer.wordpress.com/apps' },
  devto: { label: 'dev.to Settings', url: 'https://dev.to/settings/extensions' },
  hashnode: { label: 'Hashnode Settings', url: 'https://hashnode.com/settings/developer' },
  medium: { label: 'Medium Integration', url: 'https://medium.com/me/settings/apps' },
  mastodon: { label: 'Mastodon Instance', url: null },
  bluesky: { label: 'Bluesky Settings', url: 'https://bsky.app/settings/app-passwords' },
};

// Mirrors the kernel's ChannelSetupDescriptor (libraries/providers/kernel) as
// serialized by IntegrationManager.getSocialProviderCatalog(). clientId /
// clientSecret post the same DTO fields as before; any other key is folded
// into the DTO's `additionalConfig` JSON (e.g. Meta FBfB `configId`).
export interface ChannelCredentialField {
  key: 'clientId' | 'clientSecret' | (string & {});
  label: string;
  placeholder?: string;
  help?: string;
  secret?: boolean;
  optional?: boolean; // empty value is accepted and not persisted
}

export interface ChannelSetupDescriptor {
  authType: 'oauth1' | 'oauth2' | 'token' | 'direct';
  credentialFields: ChannelCredentialField[];
  portalUrl?: string;
  portalLabel?: string;
  callbackInstructions?: string;
  setupSteps?: string[];
}

// Account-credential fields declared by 'direct' providers (Bluesky & co.) —
// served by the provider catalog's customFields and rendered by this form so
// direct channels can connect from Settings (the composer flow that used to
// collect them is gone).
export interface ChannelCustomField {
  key: string;
  label: string;
  defaultValue?: string;
  validation: string;
  type: 'text' | 'password';
}

export interface ChannelVpnSelection {
  enabled: boolean;
  identifier?: string;
  regionId?: string;
}

export interface ChannelConfigInstance {
  id: string;
  name: string;
  enabled: boolean;
  scopes: string;
  redirectUri: string;
  setupNotes: string;
  isConfigured: boolean;
  /** Non-secret stored credential values (App ID, FBfB Configuration ID, …),
   *  returned by the API so edit mode can prefill them. Secret fields are
   *  never included — they stay write-only. */
  displayValues?: Record<string, string>;
  /** Pinned provider version of this config — keeps the version select on the
   *  stored version instead of silently defaulting to latest-active on edit. */
  version?: string;
  vpnSelection?: ChannelVpnSelection | null;
}

interface ChannelConfigFormProps {
  identifier: string;
  providerName: string;
  defaultScopes?: string;
  setup?: ChannelSetupDescriptor | null;
  callbackUrl?: string;
  platformConfigured?: boolean; // env supplies a platform app for this provider
  customFields?: ChannelCustomField[] | false; // 'direct' providers' account fields
  config?: ChannelConfigInstance; // present => edit mode
  onClose: () => void;
  onSaved: () => void;
  // Called once an account actually got connected (OAuth popup / token / direct).
  onConnected?: () => void;
  // Open the installer/technical view directly (link sent to the installer).
  startTechnical?: boolean;
}

export const ChannelConfigForm: FC<ChannelConfigFormProps> = ({
  identifier,
  providerName,
  defaultScopes = '',
  setup = null,
  callbackUrl = '',
  platformConfigured = false,
  customFields = false,
  config,
  onClose,
  onSaved,
  onConnected,
  startTechnical,
}) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const isEdit = !!config;
  const isConfigured = config?.isConfigured || false;
  // Direct channels connect with account credentials in the composer flow —
  // the config form collects no credentials for them.
  const isDirect = setup?.authType === 'direct';
  const isOAuth = setup?.authType === 'oauth1' || setup?.authType === 'oauth2';
  const isToken = setup?.authType === 'token';
  // Mode A of this form: a platform app in the deployment env can drive the
  // connect flow (OAuth consent, or a bot-token connect for token providers),
  // so name + Connect is the primary content.
  const hasPlatformApp = platformConfigured && (isOAuth || isToken);
  // Interactive connect component for token providers that need one
  // (Telegram's /connect-word discovery); token providers without one connect
  // by token validation alone.
  const Web3Connect = useMemo(
    () => web3List.find((item) => item.identifier === identifier)?.component,
    [identifier]
  );
  // In-progress token connect: the issued state nonce plus the saved set id
  // (needed to flip the set enabled after a successful connect). Renders
  // Web3Connect when the provider has an interactive connect component.
  // Main networks show a plain one-button screen; the developer-app setup is a
  // separate "technical" view for whoever installs the system.
  const [technical, setTechnical] = useState(!!startTechnical);
  const [linkCopied, setLinkCopied] = useState(false);
  const [tokenNonce, setTokenNonce] = useState<{ nonce: string; id: string } | null>(null);

  // Connected channels for this provider (the composer list) — after a
  // successful Connect the modal must SAY so, not silently offer Connect again.
  // `/integrations/list` is a SHARED SWR key whose consumers expect the bare
  // array (see useIntegrationList) — unwrap here or the raw envelope poisons
  // the cache and crashes dashboard/analytics with `.map is not a function`.
  const { data: integrationList } = useSWR<Array<{
    identifier: string;
    name: string;
    disabled: boolean;
    inBetweenSteps?: boolean;
  }>>(
    '/integrations/list',
    (url: string) =>
      fetch(url)
        .then(async (r) => {
          const json = r.ok ? await r.json().catch(() => null) : null;
          return Array.isArray(json?.integrations) ? json.integrations : [];
        })
        .catch(() => [])
  );
  const connectedChannels = useMemo(
    () =>
      (integrationList || []).filter(
        (ch) => ch.identifier === identifier && !ch.disabled && !ch.inBetweenSteps
      ),
    [integrationList, identifier]
  );

  // Pre-filled so the name is never the thing blocking a first connect.
  const [name, setName] = useState(config?.name || providerName || '');
  // Non-secret stored values prefill in edit mode (they're identifiers, not
  // secrets — the API returns them in displayValues). Secrets (clientSecret,
  // bot tokens) stay write-only: blank keeps the stored value.
  const [clientId, setClientId] = useState(config?.displayValues?.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [extraFields, setExtraFields] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(config?.displayValues || {})) {
      if (k !== 'clientId' && k !== 'clientSecret') out[k] = v;
    }
    return out;
  });
  const [editSetupNotes, setEditSetupNotes] = useState(config?.setupNotes || '');
  // A set must not be enabled before it is set up — BYO sets need their keys,
  // platform-app sets become enabled after a successful Connect.
  const [enabled, setEnabled] = useState(config?.enabled || false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // Set id created by a Connect-initiated save in this modal session — lets a
  // connect retry PUT-update the same set instead of POSTing a duplicate.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [callbackCopied, setCallbackCopied] = useState(false);
  // With a platform app configured, everything but name + Connect lives under
  // the Advanced section — expanded only when this set already has stored
  // credentials (a BYO-app set being edited).
  const [showAdvanced, setShowAdvanced] = useState(isConfigured && !isOAuth);

  const {
    versions,
    selected: selectedVersion,
    selectVersion,
  } = useProviderVersionSelection('social', identifier, config?.version);

  // Optional VPN egress: built from the org's enabled VPN provider×region combos.
  const { data: vpnConfig } = useVpnConfig();
  const vpnOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const p of vpnConfig?.providers ?? []) {
      if (!p.enabled || !p.isConfigured) continue;
      for (const id of p.enabledRegions ?? []) {
        const region = p.proxyRegions?.find((r) => r.id === id);
        if (!region) continue;
        out.push({ value: `${p.identifier}:${id}`, label: `${p.name}: ${region.label}` });
      }
    }
    return out;
  }, [vpnConfig]);

  const [vpnEnabled, setVpnEnabled] = useState(config?.vpnSelection?.enabled || false);
  const [vpnValue, setVpnValue] = useState(
    config?.vpnSelection?.identifier && config?.vpnSelection?.regionId
      ? `${config.vpnSelection.identifier}:${config.vpnSelection.regionId}`
      : ''
  );

  // 'direct' providers' account-credential fields (Bluesky handle + app
  // password, …), rendered as the connect form in Mode B.
  const directFields: ChannelCustomField[] | null =
    isDirect && Array.isArray(customFields) && customFields.length
      ? customFields
      : null;
  const [directValues, setDirectValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const field of customFields || []) {
      out[field.key] = field.defaultValue || '';
    }
    return out;
  });

  // Saves the config set (creating it first when needed). Returns the saved
  // set's id on success, or null when validation/save failed (the toast is
  // already shown). Shared by "Save" and by the platform-app "Connect" button,
  // which needs the set's id to bind the OAuth flow to it. `opts.enable`
  // overrides the enabled flag for the save — direct-channel Connect enables
  // the set up front because the connect initiation itself is gated on an
  // enabled set (and direct sets hold no credentials to wait for).
  const saveConfig = useCallback(async (opts?: { enable?: boolean }): Promise<{ id: string | null } | null> => {
    const effEnabled = opts?.enable ?? enabled;
    if (!name.trim()) {
      toaster.show(t('channel_name_required', 'Please enter a name for this channel.'), 'warning');
      return null;
    }
    // A platform app supplies the OAuth credentials, so no Client ID is
    // required to enable the set when one is configured for this provider.
    if (effEnabled && !isDirect && !clientId.trim() && !isConfigured && !platformConfigured) {
      toaster.show(
        t('credentials_required', 'Please enter a Client ID / API Key before enabling this provider.'),
        'warning'
      );
      return null;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        enabled: effEnabled,
      };
      if (clientId.trim()) payload.clientId = clientId.trim();
      if (clientSecret.trim()) payload.clientSecret = clientSecret.trim();
      // Extra descriptor fields persist into the encrypted additionalConfig
      // JSON blob. Sent only when at least one has a value: the blob replaces
      // the stored one wholesale, so omitting it keeps stored values (and
      // other keys) intact. Empty optional fields are never persisted.
      const extras: Record<string, string> = {};
      for (const field of setup?.credentialFields || []) {
        if (field.key === 'clientId' || field.key === 'clientSecret') continue;
        const value = (extraFields[field.key] || '').trim();
        if (value) extras[field.key] = value;
      }
      if (Object.keys(extras).length) {
        payload.additionalConfig = JSON.stringify(extras);
      }
      if (selectedVersion) payload.version = selectedVersion;
      if (editSetupNotes.trim()) payload.setupNotes = editSetupNotes.trim();
      if (vpnOptions.length) {
        if (vpnEnabled && vpnValue) {
          const sep = vpnValue.indexOf(':');
          payload.vpnSelection = {
            enabled: true,
            identifier: vpnValue.slice(0, sep),
            regionId: vpnValue.slice(sep + 1),
          };
        } else {
          payload.vpnSelection = { enabled: false };
        }
      }

      // After a Connect-initiated create the modal still isn't in edit mode —
      // remember the new set id so a connect RETRY updates it instead of
      // POSTing a duplicate name (observed live: 409 on LINE connect retry).
      const existingId = isEdit ? config!.id : createdId;
      const res = existingId
        ? await fetch(`/channels/config/${existingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/channels/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, ...payload }),
          });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const id = existingId || body?.id || null;
        if (id && !isEdit) setCreatedId(id);
        return { id };
      }
      const errBody = await res.json().catch(() => ({}));
      toaster.show(errBody.message || t('channel_save_failed', 'Failed to save channel'), 'warning');
      return null;
    } catch {
      toaster.show(t('network_error_saving', 'Network error while saving'), 'warning');
      return null;
    } finally {
      setSaving(false);
    }
  }, [name, enabled, clientId, clientSecret, extraFields, setup, selectedVersion, editSetupNotes, isDirect, platformConfigured, vpnOptions, vpnEnabled, vpnValue, isConfigured, isEdit, config, createdId, identifier, fetch, toaster, t]);

  const handleSave = useCallback(async () => {
    const saved = await saveConfig();
    if (!saved) return;
    toaster.show(t('channel_saved', 'Channel saved'), 'success');
    onSaved();
    onClose();
  }, [saveConfig, toaster, t, onSaved, onClose]);

  // Token-connect completion, shared by Telegram's inline /connect-word flow
  // and LINE's token-validation connect: POST code+state to social-connect
  // from this modal instead of redirecting the page through
  // continue.integration — a failure there dumped the user on /posts with the
  // real reason invisible (observed live: the Telegram /connect word outlived
  // the 1h OAuth-state TTL and the callback 400'd "Invalid or expired state").
  const completeTokenConnect = useCallback(
    async (code: string | number, state: string, id: string) => {
      setConnecting(true);
      try {
        const res = await fetch(`/integrations/social-connect/${identifier}`, {
          method: 'POST',
          body: JSON.stringify({
            state,
            // Telegram's connect component hands back a NUMERIC chat id — the
            // ConnectIntegrationDto whitelist rejects non-string codes with a
            // 400 ("code must be a string").
            code: String(code),
            // Same payload as continue.integration (dayjs.tz().utcOffset()).
            timezone: String(-new Date().getTimezoneOffset()),
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          // ValidationPipe 400s return message as a string ARRAY.
          const raw = errBody.message;
          const msg: string = (Array.isArray(raw) ? raw.join(', ') : raw) ||
            t('could_not_connect_to_platform', 'Could not connect to the platform');
          // An expired/unknown state is unrecoverable — return to the form so
          // the next Connect click mints a fresh one.
          if (msg.includes('Invalid or expired state')) {
            setTokenNonce(null);
            toaster.show(
              t('connect_session_expired', 'Connect session expired — please try again'),
              'warning'
            );
            return;
          }
          toaster.show(msg, 'warning');
          return;
        }
        // Connected — the set is fully set up now, so enable it (a set must
        // not be enabled before it is set up).
        if (!enabled) {
          await fetch(`/channels/config/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true }),
          }).catch(() => undefined);
        }
        toaster.show(t('channel_connected', 'Channel Connected!'), 'success');
        onSaved();
        onClose();
        onConnected?.();
      } catch {
        toaster.show(
          t('could_not_connect_to_platform', 'Could not connect to the platform'),
          'warning'
        );
      } finally {
        setConnecting(false);
      }
    },
    [fetch, identifier, enabled, toaster, t, onSaved, onClose]
  );

  // Token-provider connect (Telegram/LINE bot tokens): save the set, mint the
  // state nonce, then either hand it to the interactive connect component
  // (Telegram's /connect-word discovery) or complete the token-validation
  // connect inline (LINE validates the token server-side — no user step).
  const handleTokenConnect = useCallback(async () => {
    const saved = await saveConfig();
    if (!saved) return;
    const id = saved.id;
    if (!id) {
      toaster.show(t('channel_save_failed', 'Failed to save channel'), 'warning');
      return;
    }
    setConnecting(true);
    try {
      const response = await fetch(`/integrations/social/${identifier}?config=${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.err || !data.url) {
        toaster.show(
          t('could_not_connect_to_platform', 'Could not connect to the platform'),
          'warning'
        );
        return;
      }
      if (Web3Connect) {
        // Render the interactive connect (e.g. Telegram: add the bot to the
        // channel, post /connect <word>) inside this modal.
        setTokenNonce({ nonce: data.url, id });
        return;
      }
      // LINE's authenticate ignores `code` — the bot token IS the credential.
      await completeTokenConnect('connect', data.url, id);
    } finally {
      setConnecting(false);
    }
  }, [saveConfig, fetch, identifier, Web3Connect, toaster, t, completeTokenConnect]);

  // Direct-channel connect (Bluesky & co.): validate the account-credential
  // fields, save the set ENABLED (direct sets hold no app credentials, and
  // connect initiation is gated on an enabled set), mint the state, then
  // complete inline — code is base64(JSON) of the field values, the same
  // payload the old composer connect flow posted.
  const handleDirectConnect = useCallback(async () => {
    if (!directFields) return;
    for (const field of directFields) {
      const value = (directValues[field.key] || '').trim();
      const splitter = field.validation.split('/');
      const regex = new RegExp(splitter.slice(1, -1).join('/'), splitter.pop());
      if (!regex.test(value)) {
        toaster.show(`${field.label} is invalid`, 'warning');
        return;
      }
    }
    const saved = await saveConfig({ enable: true });
    if (!saved) return;
    const id = saved.id;
    if (!id) {
      toaster.show(t('channel_save_failed', 'Failed to save channel'), 'warning');
      return;
    }
    setConnecting(true);
    try {
      const response = await fetch(`/integrations/social/${identifier}?config=${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.err || !data.url) {
        toaster.show(
          t('could_not_connect_to_platform', 'Could not connect to the platform'),
          'warning'
        );
        return;
      }
      const payload: Record<string, string> = {};
      for (const field of directFields) {
        payload[field.key] = (directValues[field.key] || '').trim();
      }
      await completeTokenConnect(btoa(JSON.stringify(payload)), data.url, id);
    } finally {
      setConnecting(false);
    }
  }, [directFields, directValues, saveConfig, fetch, identifier, toaster, t, completeTokenConnect]);

  // Platform-app connect: save the set, then start the standard OAuth flow
  // (the same /integrations/social/:identifier?config=<id> initiation the
  // composer tile uses) in a small popup window. The completion page
  // (continue.integration) detects the popup, notifies this opener, and closes
  // itself; the poll is the fallback for a missed message / manual close.
  const handleConnect = useCallback(async () => {
    if (isToken) {
      return handleTokenConnect();
    }
    // Own-app OAuth: connect initiation is gated on an enabled set, so save it
    // enabled — but only once both app credentials are present.
    if (!hasPlatformApp && !isConfigured && (!clientId.trim() || !clientSecret.trim())) {
      toaster.show(
        t('fill_app_credentials_first', 'Fill in both app keys first (following the steps above).'),
        'warning'
      );
      return;
    }
    const saved = await saveConfig(hasPlatformApp ? undefined : { enable: true });
    if (!saved) return;
    const id = saved.id;
    if (!id) {
      // Should not happen — the API returns the created row — but the OAuth
      // flow cannot start without a set to bind to.
      toaster.show(t('channel_save_failed', 'Failed to save channel'), 'warning');
      return;
    }
    setConnecting(true);
    try {
      const response = await fetch(`/integrations/social/${identifier}?config=${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.err || !data.url) {
        toaster.show(
          t('could_not_connect_to_platform', 'Could not connect to the platform'),
          'warning'
        );
        return;
      }
      const popup = window.open(data.url, 'postmill-oauth', 'width=640,height=720,popup');
      if (!popup) {
        // Popup blocked — fall back to the standard full-page OAuth redirect.
        window.location.href = data.url;
        return;
      }
      const poll = window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          // Refresh without closing: the connect may have completed.
          onSaved();
        }
      }, 1000);
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if ((event.data as { type?: string })?.type !== 'postmill:channel-connected') return;
        cleanup();
        // The connect completed — the set is fully set up now, so enable it
        // (a set must not be enabled before it is set up).
        void (async () => {
          if (!enabled) {
            await fetch(`/channels/config/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: true }),
            }).catch(() => undefined);
          }
          toaster.show(t('channel_connected', 'Channel Connected!'), 'success');
          onSaved();
          onClose();
          onConnected?.();
        })();
      };
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.clearInterval(poll);
      };
      window.addEventListener('message', onMessage);
    } finally {
      setConnecting(false);
    }
  }, [saveConfig, fetch, identifier, enabled, toaster, t, onSaved, onClose, isToken, handleTokenConnect, hasPlatformApp, isConfigured, clientId, clientSecret]);

  const handleDelete = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/channels/config/${config.id}`, { method: 'DELETE' });
      if (!res.ok) throw createFetchError('channel_remove_failed', 'Failed to remove channel');
      toaster.show(t('channel_removed', 'Channel removed'), 'success');
      onSaved();
      onClose();
    } catch {
      toaster.show(t('channel_remove_failed', 'Failed to remove channel'), 'warning');
    } finally {
      setSaving(false);
    }
  }, [config, fetch, toaster, t, onSaved, onClose]);

  const handleTest = useCallback(async () => {
    if (!config) return;
    try {
      const res = await fetch(`/channels/config/${config.id}/test`, { method: 'POST' });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        toaster.show(t('config_valid', 'Configuration valid'), 'success');
      } else {
        toaster.show(result.error || t('test_failed', 'Test failed'), 'warning');
      }
    } catch {
      toaster.show(t('test_failed', 'Test failed'), 'warning');
    }
  }, [config, fetch, toaster, t]);

  const credentialPlaceholder = isConfigured
    ? t('configured_keep_or_replace', 'Configured — leave blank to keep, or paste a new value to replace')
    : '';
  // Descriptor-driven portal link wins; the static map is the fallback for
  // providers that don't declare a setupDescriptor yet.
  const appLink = setup?.portalUrl
    ? { label: setup.portalLabel || setup.portalUrl, url: setup.portalUrl }
    : PROVIDER_APP_LINKS[identifier];
  // Descriptor-driven credential fields; the generic pair is the fallback.
  const credentialFields: ChannelCredentialField[] = setup?.credentialFields?.length
    ? setup.credentialFields
    : [
        { key: 'clientId', label: t('client_id', 'Client ID / API Key') },
        { key: 'clientSecret', label: t('client_secret', 'Client Secret / API Secret'), secret: true },
      ];

  // Plain-language Hebrew guide for the featured networks; null → adapter text.
  const guide = channelGuide(t, identifier);
  const setupSteps = guide?.steps || setup?.setupSteps || [];
  const callbackHelp = guide?.callbackHelp || setup?.callbackInstructions;
  const httpsBlocked = !!guide?.requiresHttps && callbackUrl.startsWith('http://');
  // "Facebook" rather than the catalog's "Facebook Page" in sentences.
  const brandName =
    featuredChannels(t).find(
      (f) => f.identifier === identifier || f.alternative?.identifier === identifier
    )?.title || providerName;

  const handleCopyCallback = useCallback(async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCallbackCopied(true);
      setTimeout(() => setCallbackCopied(false), 2000);
    } catch {
      toaster.show(t('copy_failed', 'Copy failed'), 'warning');
    }
  }, [callbackUrl, toaster, t]);

  const credentialFieldsBlock = setup?.authType !== 'direct' && credentialFields.map((field) => {
    const isExtra = field.key !== 'clientId' && field.key !== 'clientSecret';
    const value = field.key === 'clientId'
      ? clientId
      : field.key === 'clientSecret'
        ? clientSecret
        : (extraFields[field.key] || '');
    const setValue = field.key === 'clientId'
      ? setClientId
      : field.key === 'clientSecret'
        ? setClientSecret
        : (v: string) => setExtraFields((prev) => ({ ...prev, [field.key]: v }));
    return (
      <div key={field.key} className="flex flex-col gap-[6px]">
        <label className="text-[14px] font-[500]">
          {guide?.fields[field.key]?.label || field.label}
          {field.optional && (
            <span className="text-[12px] text-newTableText font-[400]"> ({t('optional', 'optional')})</span>
          )}
        </label>
        <div className="bg-newBgColorInner h-[42px] border-newTableBorder border rounded-[8px] text-textColor flex items-center justify-center">
          <input
            // Keep browser password managers out of credential fields. Chrome
            // ignores autoComplete="off" once a type=password input is on the
            // page and fills the login password into the secret and the email
            // into the next text field (observed live: test@test.com in
            // Configuration ID). No password-type input at all → nothing to
            // autofill; the secret is masked with -webkit-text-security.
            type="text"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            style={field.secret ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties) : undefined}
            name={`cred_${field.key}_${identifier}`}
            className="h-full bg-transparent outline-hidden flex-1 text-[14px] text-textColor placeholder-textColor px-[16px]"
            placeholder={(isExtra ? '' : credentialPlaceholder) || field.placeholder || ''}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {(guide?.fields[field.key]?.help || field.help) && (
          <div className="text-[12px] text-newTableText">
            {guide?.fields[field.key]?.help || field.help}
          </div>
        )}
      </div>
    );
  });

  // ── Layout blocks (shared by both modes) ────────────────────────────────

  const portalLinkBlock = appLink?.url && (
    <a
      href={appLink.url}
      target="_blank"
      rel="noopener noreferrer"
      className="self-start inline-flex items-center gap-[6px] h-[36px] px-[14px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[13px] text-textColor hover:bg-boxHover"
    >
      {t('fc_open_portal', 'Open {{portal}}', { portal: appLink.label })}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  );

  const setupStepsBlock = setupSteps.length > 0 && (
    <div className="flex flex-col gap-[10px] bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[14px]">
      <div className="flex items-center justify-between gap-[8px]">
        <label className="text-[14px] font-[600]">{t('setup_steps', 'How to set this up')}</label>
        {guide && (
          <span className="text-[12px] text-newTableText">
            {t('fc_one_time', 'One time only, about 10 minutes')}
          </span>
        )}
      </div>
      <ol className="flex flex-col gap-[8px]">
        {setupSteps.map((step, idx) => (
          <li key={idx} className="flex gap-[10px] items-start text-[13px] leading-[1.6] text-textColor">
            <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-btnPrimary/15 text-btnPrimary text-[12px] font-[600] flex items-center justify-center mt-[1px]">
              {idx + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {guide?.note && (
        <div className="text-[12px] text-newTableText border-t border-newTableBorder pt-[8px]">
          {guide.note}
        </div>
      )}
    </div>
  );

  // What happens to the keys — stated plainly, and true: credentials and
  // account tokens are encrypted at rest in this installation's own database.
  const securityBlock = (isOAuth || isToken) && (
    <div className="flex gap-[10px] items-start rounded-[8px] border border-green-600/30 bg-green-600/10 p-[12px]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400 shrink-0 mt-[1px]" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <div className="flex flex-col gap-[2px] text-[12px] leading-[1.6]">
        <span className="font-[600] text-textColor">
          {t('fc_secure_title', 'Protected and local')}
        </span>
        <span className="text-newTableText">
          {t(
            'fc_secure_body',
            'The keys and the account connection are stored encrypted only in this system’s database. They are not sent to Postmill or any other party — the login itself happens directly on {{provider}}’s own site, and you never type your password here.',
            { provider: brandName }
          )}
        </span>
      </div>
    </div>
  );

  const nameBlock = (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[13px] font-[500]">
        {t('channel_name', 'Channel name')} <span className="text-red-500">*</span>
      </label>
      <Input
        label=""
        name={`name_${identifier}`}
        disableForm={true}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('channel_name_placeholder', 'e.g. Marketing LinkedIn')}
      />
    </div>
  );

  const versionBlock = (
    <ProviderVersionSelect
      versions={versions}
      value={selectedVersion}
      onChange={selectVersion}
      label={t('provider_version', 'Provider version')}
    />
  );

  // Enabling only makes sense once the set exists — the switch is edit-mode
  // only. Styled like the VPN toggle; position alone carries the state.
  const enabledBlock = isEdit && (
    <div className="flex items-center gap-[8px]">
      <label className="text-[13px] font-[500]">{t('enabled', 'Enabled')}</label>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          if (!enabled && !isDirect && !clientId.trim() && !isConfigured && !platformConfigured) {
            toaster.show(
              t('credentials_required', 'Please enter a Client ID / API Key before enabling this provider.'),
              'warning'
            );
            return;
          }
          setEnabled(!enabled);
        }}
        className="flex items-center gap-[8px]"
      >
        <span
          className={`relative w-[40px] h-[22px] rounded-full transition-colors ${
            enabled ? 'bg-btnPrimary' : 'bg-newTableBorder'
          }`}
        >
          <span
            className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-[18px]' : 'translate-x-0'
            }`}
          />
        </span>
      </button>
    </div>
  );

  // Connect path: the default for platform-app providers (OAuth popup or
  // bot-token connect), and also offered on BYO token sets once credentials
  // are stored (a token set without a token cannot connect).
  const showConnect = hasPlatformApp || (isToken && isConfigured) || isOAuth;

  // Direct-channel account fields + Connect (Bluesky & co.) — the primary
  // content of Mode B for these providers.
  const directFieldsBlock = directFields?.map((field) => (
    <div key={field.key} className="flex flex-col gap-[6px]">
      <label className="text-[14px] font-[500]">{field.label}</label>
      <div className="bg-newBgColorInner h-[42px] border-newTableBorder border rounded-[8px] text-textColor flex items-center justify-center">
        <input
          type={field.type === 'password' ? 'password' : 'text'}
          autoComplete="off"
          name={`direct_${field.key}_${identifier}`}
          className="h-full bg-transparent outline-hidden flex-1 text-[14px] text-textColor placeholder-textColor px-[16px]"
          value={directValues[field.key] || ''}
          onChange={(e) =>
            setDirectValues((prev) => ({ ...prev, [field.key]: e.target.value }))
          }
        />
      </div>
    </div>
  ));

  const directConnectBlock = !!directFields && (
    <button
      type="button"
      onClick={handleDirectConnect}
      disabled={saving || connecting}
      className="w-full h-[44px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500] whitespace-nowrap truncate hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {connecting
        ? t('connecting', 'Connecting...')
        : t('connect_with_provider', 'Connect with {{provider}}', { provider: providerName })}
    </button>
  );
  const connectBlock = showConnect && (
    <div className="flex flex-col gap-[6px]">
      {connectedChannels.length > 0 && (
        <div className="flex items-center gap-[8px] rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[12px] py-[10px]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="text-green-500 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[13px] text-textColor">
            {t('connected_as', 'Connected as {{name}}', {
              name: connectedChannels.map((ch) => ch.name).join(', '),
            })}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={handleConnect}
        disabled={saving || connecting}
        className="w-full h-[44px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500] whitespace-nowrap truncate hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {connecting
          ? t('connecting', 'Connecting...')
          : connectedChannels.length > 0
            ? t('connect_another_account', 'Connect another account')
            : hasPlatformApp
              ? t('connect_with_provider', 'Connect with {{provider}}', { provider: providerName })
              : t('fc_save_and_connect', 'Save and connect to {{provider}}', { provider: brandName })}
      </button>
      {platformConfigured && (
        <div className="text-[12px] text-newTableText text-center">
          {t('uses_postmill_app_no_setup', 'Uses the Postmill app — no setup needed')}
        </div>
      )}
    </div>
  );

  {/* Callback registration is an OAuth-app concern only; token and direct
      channels never register a callback. */}
  const callbackBlock = !!callbackUrl && setup?.authType !== 'token' && setup?.authType !== 'direct' && (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[13px] font-[500]">
        {guide ? t('fc_return_address', 'Return address (copy it into the app)') : t('callback_url', 'Callback URL')}
      </label>
      <div className="flex gap-[8px] items-center">
        <div className="bg-newBgColorInner h-[42px] border-newTableBorder border rounded-[8px] text-textColor flex items-center justify-center flex-1 min-w-0">
          <input
            readOnly
            className="h-full bg-transparent outline-hidden flex-1 min-w-0 text-[14px] text-textColor placeholder-textColor px-[16px]"
            value={callbackUrl}
          />
        </div>
        <Button
          type="button"
          className="bg-transparent! border border-newTableBorder text-textColor text-[12px] whitespace-nowrap"
          onClick={handleCopyCallback}
        >
          {callbackCopied ? t('copied', 'Copied') : t('copy', 'Copy')}
        </Button>
      </div>
      {callbackHelp && (
        <div className="text-[12px] text-newTableText">{callbackHelp}</div>
      )}
      {httpsBlocked && (
        <div className="text-[12px] rounded-[8px] border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400 p-[10px] leading-[1.6]">
          {t(
            'fc_https_required',
            '{{provider}} only accepts secure (https) addresses. While the system runs on this computer at an http address, the connection to {{provider}} will not work — it will once the system has an https address.',
            { provider: brandName }
          )}
        </div>
      )}
    </div>
  );

  const scopesBlock = !!defaultScopes && (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[13px] font-[500]">{t('default_scopes', "Permissions we'll request")}</label>
      <div className="text-[12px] text-newTableText break-words">{defaultScopes}</div>
    </div>
  );

  {/* No Redirect-URI / scopes overrides here: those are platform wiring, not
      user settings. The default callback is displayed read-only above; the
      adapter-declared scopes always apply. */}
  const notesBlock = (config?.setupNotes || editSetupNotes) && (
    <div className="flex flex-col gap-[4px]">
      <label className="text-[13px] font-[500]">{t('setup_instructions', 'Setup Instructions')}</label>
      <textarea
        value={editSetupNotes}
        onChange={(e) => setEditSetupNotes(e.target.value)}
        className="p-[8px] rounded-[8px] border border-newTableBorder bg-bgInput text-textColor min-h-[80px] text-[14px]"
        rows={3}
      />
    </div>
  );

  const campaignBlock = isEdit && config?.id && (
    <CampaignSelector entityType="channel" entityId={config.id} />
  );

  const vpnBlock = vpnOptions.length > 0 && (
    <div className="flex gap-[12px] items-end">
      <div className="flex flex-col gap-[6px]">
        <label className="text-[13px] font-[500]">{t('vpn_connection', 'VPN connection')}</label>
        <button
          type="button"
          role="switch"
          aria-checked={vpnEnabled}
          onClick={() => setVpnEnabled((v) => !v)}
          className="flex items-center gap-[8px]"
        >
          <span
            className={`relative w-[40px] h-[22px] rounded-full transition-colors ${
              vpnEnabled ? 'bg-btnPrimary' : 'bg-newTableBorder'
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                vpnEnabled ? 'translate-x-[18px]' : 'translate-x-0'
              }`}
            />
          </span>
          <span className="text-[14px] text-textColor">
            {vpnEnabled ? t('enabled', 'Enabled') : t('disabled', 'Disabled')}
          </span>
        </button>
      </div>
      <div className="flex-1 flex flex-col gap-[6px]">
        <label className="text-[13px] font-[500]">{t('vpn_region', 'Provider & region')}</label>
        <ChannelVpnRegionSelect
          value={vpnValue}
          options={vpnOptions}
          disabled={!vpnEnabled}
          placeholder={t('vpn_region_placeholder', 'Search provider: region…')}
          onChange={setVpnValue}
        />
      </div>
    </div>
  );

  const footerBlock = (
    <div className="flex gap-[8px] justify-between items-center mt-[8px]">
      <div className="flex gap-[8px]">
        <Button
          type="button"
          className="bg-transparent! border border-newTableBorder text-textColor"
          onClick={onClose}
        >
          {t('cancel', 'Cancel')}
        </Button>
      </div>
      <div className="flex gap-[8px]">
        {isEdit && (
          <>
            <Button
              type="button"
              className="bg-transparent! border border-red-500/30 text-dangerText text-[12px]"
              onClick={handleDelete}
              disabled={saving}
            >
              {t('remove', 'Remove')}
            </Button>
            {isConfigured && (
              <Button
                type="button"
                className="bg-transparent! border border-newTableBorder text-textColor text-[12px]"
                onClick={handleTest}
              >
                {t('test', 'Test')}
              </Button>
            )}
          </>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          // With an own-app connect button on screen, plain Save is secondary.
          className={isOAuth && showConnect ? 'bg-transparent! border border-newTableBorder text-textColor' : undefined}
        >
          {saving ? t('saving', 'Saving...') : t('save', 'Save')}
        </Button>
      </div>
    </div>
  );

  // ── Token connect in progress: the interactive connect component (Telegram's
  // /connect-word discovery) replaces the form until it completes inline
  // (completeTokenConnect posts to social-connect and closes the modal) or
  // the user goes back. ────────────────────────────────────────────────────
  if (tokenNonce && Web3Connect) {
    return (
      <div className="flex flex-col gap-[16px] w-[640px] max-w-full">
        <Web3Connect
          nonce={tokenNonce.nonce}
          onComplete={(code, newState) => {
            void completeTokenConnect(code, newState, tokenNonce.id);
          }}
        />
        <div className="flex gap-[8px]">
          <Button
            type="button"
            className="bg-transparent! border border-newTableBorder text-textColor"
            onClick={() => setTokenNonce(null)}
          >
            {t('back', 'Back')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Simple mode for the main networks: one button for the customer. ─────
  if (guide && !technical) {
    const ready = hasPlatformApp || isConfigured;
    const pageStep =
      identifier === 'tiktok'
        ? t('fc_simple_s3_tiktok', 'Approve access — done')
        : identifier === 'linkedin'
          ? t('fc_simple_s3_profile', 'Approve — done')
          : t('fc_simple_s3', 'Choose your business page and approve — done');
    const techLink = () => {
      const url = `${window.location.origin}/settings/channels?setup=${identifier}&tech=1`;
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setLinkCopied(true);
          toaster.show(
            t('fc_link_copied', 'Link copied — paste it into WhatsApp or an email to your installer'),
            'success'
          );
        })
        .catch(() => toaster.show(t('copy_failed', 'Copy failed'), 'warning'));
    };
    return (
      <div className="flex flex-col items-center gap-[24px] w-[560px] max-w-full py-[8px] text-center">
        <Image
          src={`/icons/platforms/${identifier}.png`}
          alt=""
          width={72}
          height={72}
          className="rounded-full"
        />
        {connectedChannels.length > 0 && (
          <div className="w-full flex items-center justify-center gap-[8px] rounded-[12px] bg-green-600/10 border border-green-600/30 p-[14px]">
            <span className="text-[20px]" aria-hidden="true">✓</span>
            <span className="text-[17px] text-textColor">
              {t('fc_already_connected', 'Already connected: {{name}}', {
                name: connectedChannels.map((ch) => ch.name).join(', '),
              })}
            </span>
          </div>
        )}
        {ready ? (
          <>
            <ol className="w-full flex flex-col gap-[14px] text-start">
              {[
                t('fc_simple_s1', 'Press the big button below'),
                t('fc_simple_s2', 'A {{brand}} window opens. Sign in as usual, with your own username and password', { brand: brandName }),
                pageStep,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-[14px]">
                  <span className="shrink-0 w-[34px] h-[34px] rounded-full bg-btnPrimary text-white text-[17px] font-[700] flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[18px] leading-[1.5] text-textColor pt-[3px]">{step}</span>
                </li>
              ))}
            </ol>
            {httpsBlocked ? (
              <div className="w-full rounded-[12px] border border-amber-500/40 bg-amber-500/10 p-[16px] text-[16px] leading-[1.6] text-textColor">
                {t('fc_simple_https', '{{brand}} can only be connected once the system is online at a secure address. Please ask your installer.', { brand: brandName })}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={saving || connecting}
                className="w-full h-[60px] rounded-[14px] bg-btnPrimary text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <span className="text-[19px] font-[700]">
                  {connecting
                    ? t('fc_simple_connecting', 'Opening {{brand}}…', { brand: brandName })
                    : connectedChannels.length > 0
                      ? t('fc_simple_connect_more', 'Connect another {{brand}} account', { brand: brandName })
                      : t('fc_simple_connect', 'Connect with {{brand}}', { brand: brandName })}
                </span>
              </button>
            )}
            <p className="flex items-start gap-[10px] text-start text-[16px] leading-[1.6] text-newTableText">
              <span className="text-[18px]" aria-hidden="true">🔒</span>
              {t('fc_simple_safe', 'Your password stays with {{brand}}. We never see it and never store it.', { brand: brandName })}
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-[10px]">
              <h3 className="text-[22px] font-[700] text-textColor">
                {t('fc_simple_not_ready_title', '{{brand}} is not switched on yet', { brand: brandName })}
              </h3>
              <p className="text-[18px] leading-[1.6] text-textColor">
                {t(
                  'fc_simple_not_ready_body',
                  'Before the first connection, a short technical setup is needed — once only. The person who installed the system for you can do it in about 10 minutes. After that, connecting is one click.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={techLink}
              className="w-full h-[60px] rounded-[14px] bg-btnPrimary text-white hover:opacity-90 transition-opacity"
            >
              <span className="text-[19px] font-[700]">
                {linkCopied
                  ? t('fc_simple_link_copied_btn', 'Link copied ✓')
                  : t('fc_simple_copy_link', 'Copy a link to send to the installer')}
              </span>
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setTechnical(true)}
          className="text-newTableText hover:text-textColor hover:underline"
        >
          <span className="text-[14px]">
            {ready
              ? t('fc_simple_tech_settings', 'Technical settings')
              : t('fc_simple_do_it_myself', 'I’ll do the technical setup myself')}
          </span>
        </button>
      </div>
    );
  }

  // ── Mode A: platform app — name + Connect are the whole story; everything
  // else is collapsed under Advanced. ────────────────────────────────────────
  if (hasPlatformApp) {
    return (
      <div className="flex flex-col gap-[16px] w-[640px] max-w-full">
        {portalLinkBlock}
        {nameBlock}
        {connectBlock}
        {securityBlock}
        {enabledBlock}
        <div className="rounded-[8px] border border-newTableBorder">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-[12px] py-[10px] text-[13px] font-[500] text-textColor"
          >
            {t('advanced', 'Advanced')}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {showAdvanced && (
            <div className="flex flex-col gap-[12px] border-t border-newTableBorder p-[12px]">
              {setupStepsBlock}
              {versionBlock}
              {credentialFieldsBlock}
              {callbackBlock}
              {scopesBlock}
              {notesBlock}
              {vpnBlock}
            </div>
          )}
        </div>
        {campaignBlock}
        {footerBlock}
      </div>
    );
  }

  // ── Mode B (own-app OAuth): guide → keys → return address → connect, with
  // the technical knobs folded under Advanced. ─────────────────────────────
  if (isOAuth) {
    return (
      <div className="flex flex-col gap-[16px] w-[640px] max-w-full">
        {guide && (
          <button type="button" onClick={() => setTechnical(false)} className="self-start text-newTableText hover:text-textColor hover:underline">
            <span className="text-[14px]">{t('fc_back_simple', 'Back to the simple screen')}</span>
          </button>
        )}
        {portalLinkBlock}
        {setupStepsBlock}
        {/* Only what the guide asks for up front; optional keys and the
            (pre-filled) name wait under Advanced. */}
        {credentialFieldsBlock && credentialFieldsBlock.filter((_, i) => !credentialFields[i].optional)}
        {callbackBlock}
        {connectBlock}
        {securityBlock}
        <div className="rounded-[8px] border border-newTableBorder">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-[12px] py-[10px] text-[13px] font-[500] text-textColor"
          >
            {t('advanced', 'Advanced')}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {showAdvanced && (
            <div className="flex flex-col gap-[12px] border-t border-newTableBorder p-[12px]">
              {nameBlock}
              {credentialFieldsBlock && credentialFieldsBlock.filter((_, i) => credentialFields[i].optional)}
              {enabledBlock}
              {versionBlock}
              {scopesBlock}
              {notesBlock}
              {vpnBlock}
            </div>
          )}
        </div>
        {campaignBlock}
        {footerBlock}
      </div>
    );
  }

  // ── Mode B: no platform app — everything is the primary content. ─────────
  return (
    <div className="flex flex-col gap-[16px] w-[640px] max-w-full">
      {portalLinkBlock}
      {setupStepsBlock}
      {nameBlock}
      {versionBlock}
      {connectBlock}
      {directFieldsBlock}
      {directConnectBlock}
      {enabledBlock}
      {credentialFieldsBlock}
      {callbackBlock}
      {scopesBlock}
      {notesBlock}
      {campaignBlock}
      {vpnBlock}
      {footerBlock}
    </div>
  );
};
