'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import SafeImage from '@postmill-ai/react/helpers/safe.image';
import { useLaunchStore } from '@postmill-ai/frontend/components/composer/store';
import { useShallow } from 'zustand/react/shallow';
import { useExistingData } from '@postmill-ai/frontend/components/launches/helpers/use.existing.data';
import { PlatformAvatar as SharedPlatformAvatar } from '@postmill-ai/frontend/components/shared/platform-avatar';
import { useT } from '@postmill-ai/react/translation/get.transation.service.client';
import { Integrations } from '@postmill-ai/frontend/components/launches/calendar.context';
import { DropdownArrowIcon } from '@postmill-ai/frontend/components/ui/icons';

const CHANNEL_SELECTOR_THRESHOLD = 4;

// The networks customers market on come first; the rest follow alphabetically.
const NETWORK_ORDER = ['facebook', 'instagram', 'instagram-standalone', 'tiktok', 'linkedin-page', 'linkedin'];
const NETWORK_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  'instagram-standalone': 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn',
  x: 'X',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
};
const networkRank = (id: string) => {
  const i = NETWORK_ORDER.indexOf(id);
  return i === -1 ? NETWORK_ORDER.length : i;
};

// Connected is not the same as able to publish: a channel whose token expired
// stays selectable (the draft keeps working) but says so.
const needsReconnect = (i: Integrations) =>
  !!(i as Integrations & { refreshNeeded?: boolean }).refreshNeeded;

const PlatformAvatar: FC<{
  integration: Integrations;
  selected: boolean;
  size?: number;
}> = ({ integration, selected, size = 42 }) => (
  <SharedPlatformAvatar
    picture={integration.picture}
    identifier={integration.identifier}
    selected={selected}
    size={size}
  />
);

export const PicksSocialsComponent: FC<{
  toolTip?: boolean;
  /**
   * When set, only integrations whose `identifier` (provider id, e.g.
   * 'instagram', 'x') is listed are shown/selectable. Used by the Designer's
   * "Create Post" export to limit the picker to channels matching the
   * design's variant types.
   */
  allowedIdentifiers?: string[];
}> = ({ toolTip, allowedIdentifiers }) => {
  const t = useT();
  const existingData = useExistingData();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const {
    locked,
    addOrRemoveSelectedIntegration,
    integrations,
    selectedIntegrations,
  } = useLaunchStore(
    useShallow((state) => ({
      integrations: state.integrations,
      selectedIntegrations: state.selectedIntegrations,
      addOrRemoveSelectedIntegration: state.addOrRemoveSelectedIntegration,
      locked: state.locked,
    }))
  );

  const selectableIntegrations = useMemo(
    () =>
      integrations.filter((f) => {
        if (
          allowedIdentifiers?.length &&
          !allowedIdentifiers.includes(f.identifier)
        ) {
          return false;
        }
        if (existingData.integration) {
          return f.id === existingData.integration;
        }
        return !f.inBetweenSteps && !f.disabled;
      }),
    [integrations, existingData.integration, allowedIdentifiers]
  );

  const isSelected = useCallback(
    (id: string) =>
      selectedIntegrations.findIndex((p) => p.integration.id === id) !== -1,
    [selectedIntegrations]
  );

  const filteredIntegrations = useMemo(() => {
    if (!search.trim()) return selectableIntegrations;
    const q = search.trim().toLowerCase();
    return selectableIntegrations.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.identifier?.toLowerCase().includes(q)
    );
  }, [selectableIntegrations, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Integrations[]>();
    for (const integration of filteredIntegrations) {
      const key = integration.identifier || 'other';
      const list = map.get(key) || [];
      list.push(integration);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => networkRank(a) - networkRank(b) || a.localeCompare(b)
    );
  }, [filteredIntegrations]);

  const networkLabel = useCallback(
    (id: string) => {
      const name = NETWORK_NAMES[id] || id.charAt(0).toUpperCase() + id.slice(1);
      if (id === 'linkedin-page') return `${name} · ${t('company_page', 'Company page')}`;
      if (id === 'instagram-standalone') return `${name} · ${t('direct_connection', 'Direct')}`;
      return name;
    },
    [t]
  );

  const toggle = useCallback(
    (integration: Integrations) => {
      if (existingData.integration || locked) return;
      addOrRemoveSelectedIntegration(integration, {});
    },
    [addOrRemoveSelectedIntegration, existingData.integration, locked]
  );

  // Select every account of a network, or clear them all when all are selected.
  const toggleGroup = useCallback(
    (items: Integrations[]) => {
      const allSelected = items.every((i) => isSelected(i.id));
      for (const integration of items) {
        if (allSelected === isSelected(integration.id)) toggle(integration);
      }
    },
    [isSelected, toggle]
  );

  // Click-outside + Escape close, mirroring CreateMenu/UserAvatarMenu.
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedList = selectedIntegrations.filter((s) =>
    selectableIntegrations.some((i) => i.id === s.integration.id)
  );

  const useDropdown = selectableIntegrations.length > CHANNEL_SELECTOR_THRESHOLD;

  if (useDropdown) {
    return (
      <div
        ref={containerRef}
        className={clsx(
          'relative',
          open && 'z-300',
          locked && 'opacity-50 pointer-events-none'
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={clsx(
            // shrink-0: this pill now shares its row with the brand picker,
            // whose label can be long enough to squeeze "Select Channels" onto
            // two lines.
            'border rounded-[8px] shrink-0 flex items-center gap-[8px] h-[36px] lg:h-[44px] px-[12px] lg:px-[16px] text-[13px] lg:text-[15px] font-[600] text-textColor select-none transition-colors whitespace-nowrap',
            open ? 'border-[#2B5CD3]' : 'border-newTextColor/10'
          )}
        >
          {selectedList.length > 0 ? (
            <div className="flex space-x-[-10px]">
              {selectedList.slice(0, 4).map(({ integration }) => (
                <div
                  key={integration.id}
                  className="rounded-full border-2 border-newBgColor"
                >
                  <PlatformAvatar integration={integration} selected size={24} />
                </div>
              ))}
              {selectedList.length > 4 && (
                <div className="rounded-full border-2 border-newBgColor bg-boxHover w-[24px] h-[24px] flex items-center justify-center text-[11px] font-semibold text-textColor">
                  +{selectedList.length - 4}
                </div>
              )}
            </div>
          ) : (
            <div className="text-newTableText">
              {t('select_channels', 'Select Channels')}
            </div>
          )}
          {selectedList.length > 0 && (
            <span className="whitespace-nowrap">
              {t('accounts_selected', '{{count}} accounts selected', {
                count: selectedList.length,
              })}
            </span>
          )}
          {selectedList.some(({ integration }) => needsReconnect(integration)) && (
            <span
              aria-label={t('some_accounts_need_reconnect', 'Some selected accounts need to be reconnected')}
              className="text-amber-600 dark:text-amber-400"
            >
              ⚠
            </span>
          )}
          <DropdownArrowIcon rotated={open} />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={t('channels', 'Channels')}
            className="absolute z-300 top-[calc(100%+8px)] start-0 w-[360px] max-w-[90vw] max-h-[420px] bg-newBgColorInner border border-newTextColor/10 rounded-[12px] menu-shadow flex flex-col"
          >
            <div className="p-[12px] border-b border-newTextColor/10">
              <div className="relative">
                <svg
                  className="absolute inset-s-[12px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-newTextColor/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search_channels', 'Search channels...')}
                  className="w-full h-[40px] ps-[38px] pe-[12px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] text-textColor outline-hidden focus:border-[#2B5CD3]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-[8px]">
              {filteredIntegrations.length === 0 && (
                <div className="text-[13px] text-newTableText text-center py-[16px]">
                  {t('no_channels_found', 'No channels found')}
                </div>
              )}
              {grouped.map(([platform, items]) => {
                const selectedCount = items.filter((i) => isSelected(i.id)).length;
                const groupState =
                  selectedCount === 0 ? 'none' : selectedCount === items.length ? 'all' : 'some';
                return (
                <div key={platform} className="mb-[8px]">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={groupState === 'all' ? true : groupState === 'some' ? 'mixed' : false}
                    onClick={() => toggleGroup(items)}
                    className="sticky top-0 z-1 w-full flex items-center gap-[8px] bg-newBgColorInner px-[8px] py-[6px] rounded-[6px] hover:bg-boxHover"
                  >
                    <span
                      className={clsx(
                        'w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center shrink-0',
                        groupState === 'none' ? 'border-newColColor' : 'bg-[#2B5CD3] border-[#2B5CD3]'
                      )}
                      aria-hidden="true"
                    >
                      {groupState === 'all' && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                      {groupState === 'some' && <span className="w-[8px] h-[2px] bg-white rounded-full" />}
                    </span>
                    <SafeImage
                      src={`/icons/platforms/${platform}.png`}
                      className="rounded-[4px] min-w-[16px] min-h-[16px]"
                      alt=""
                      width={16}
                      height={16}
                    />
                    <span className="flex-1 text-start text-[13px] font-[600] text-textColor">
                      {networkLabel(platform)}
                    </span>
                    <span className="text-[12px] text-newTableText" dir="ltr">
                      {selectedCount}/{items.length}
                    </span>
                  </button>
                  <div className="flex flex-col gap-[2px]">
                    {items.map((integration) => {
                      const selected = isSelected(integration.id);
                      return (
                        <button
                          key={integration.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => toggle(integration)}
                          className={clsx(
                            'flex items-center gap-[10px] w-full ps-[16px] pe-[8px] py-[8px] rounded-[8px] text-start transition-colors',
                            selected
                              ? 'bg-[#2B5CD3]/15 text-textColor'
                              : 'hover:bg-boxHover text-textColor'
                          )}
                        >
                          <div
                            className={clsx(
                              'w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center shrink-0',
                              selected
                                ? 'bg-[#2B5CD3] border-[#2B5CD3]'
                                : 'border-newColColor'
                            )}
                          >
                            {selected && (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12l5 5L20 7" />
                              </svg>
                            )}
                          </div>
                          <PlatformAvatar
                            integration={integration}
                            selected={false}
                            size={28}
                          />
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="text-[13px] truncate">{integration.name}</span>
                            {needsReconnect(integration) ? (
                              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                                ⚠ {t('needs_reconnect_short', 'Needs reconnecting before it can publish')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-newTableText">
                                ✓ {t('account_connected', 'Connected')}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Icon-row mode (≤4 selectable integrations)
  return (
    <div className={clsx('flex', locked && 'opacity-50 pointer-events-none')}>
      <div className="flex flex-1">
        <div className="innerComponent flex-1 flex">
          <div className="flex flex-wrap gap-[12px] flex-1">
            {selectableIntegrations.map((integration) => {
              const selected = isSelected(integration.id);
              return (
                <div
                  key={integration.id}
                  className="flex gap-[8px] items-center"
                  {...(toolTip && {
                    'data-tooltip-id': 'tooltip',
                    'data-tooltip-content': integration.name,
                  })}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-label={
                      needsReconnect(integration)
                        ? `${integration.name} · ${t('needs_reconnect_short', 'Needs reconnecting before it can publish')}`
                        : integration.name
                    }
                    onClick={() => toggle(integration)}
                    className={clsx(
                      'cursor-pointer border-2 relative rounded-full flex justify-center items-center bg-newTableHeader filter transition-all duration-500',
                      selected
                        ? 'border-[#622FF6]'
                        : 'grayscale border-transparent'
                    )}
                  >
                    {needsReconnect(integration) && (
                      <span className="absolute -top-[4px] -end-[4px] z-10 w-[16px] h-[16px] rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center" aria-hidden="true">
                        !
                      </span>
                    )}
                    <PlatformAvatar
                      integration={integration}
                      selected={selected}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
