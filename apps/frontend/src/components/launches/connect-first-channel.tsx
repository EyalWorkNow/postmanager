'use client';

import { FC } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useT } from '@postmill-ai/react/translation/get.transation.service.client';
import { featuredChannels } from '@postmill-ai/frontend/components/settings/channels/featured-channels';

// Empty state of the content area: no channel yet. The four main networks link
// straight to their step-by-step guide (one click instead of picker → card →
// settings); everything else stays one click away.
export const ConnectFirstChannel: FC<{ onMoreNetworks: () => void }> = ({
  onMoreNetworks,
}) => {
  const t = useT();
  const steps = [
    t('fc_easy_1', 'Press a network'),
    t('fc_easy_2', 'Sign in with your usual password'),
    t('fc_easy_3', 'That’s it'),
  ];
  return (
    <div className="flex-1 flex items-center justify-center p-[24px]">
      <div className="w-full max-w-[760px] flex flex-col gap-[28px]">
        <div className="flex flex-col gap-[6px] text-center">
          <h2 className="text-[28px] font-[700] text-textColor">
            {t('fc_first_title', 'Connect your first network')}
          </h2>
          <p className="text-[18px] text-newTableText">
            {t('fc_first_sub', 'Once a network is connected you can write, schedule and publish from here.')}
          </p>
        </div>

        <ol className="flex flex-wrap justify-center gap-x-[20px] gap-y-[8px]">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-[10px] text-[17px] text-textColor">
              <span className="w-[30px] h-[30px] rounded-full bg-btnPrimary text-white text-[16px] font-[700] flex items-center justify-center">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-2 mobile:grid-cols-1 gap-[14px]">
          {featuredChannels(t).map((f) => (
            <Link
              key={f.identifier}
              href={`/settings/channels?setup=${f.identifier}&return=/launches`}
              className="flex items-center gap-[16px] p-[20px] min-h-[100px] rounded-[16px] border-2 border-newTableBorder bg-newBgColorInner hover:border-btnPrimary focus-visible:border-btnPrimary transition-colors"
            >
              <Image
                src={`/icons/platforms/${f.identifier}.png`}
                alt=""
                width={52}
                height={52}
                className="rounded-full shrink-0"
              />
              <span className="flex-1 flex flex-col min-w-0 gap-[2px]">
                <span className="text-[20px] font-[700] text-textColor">{f.title}</span>
                <span className="text-[15px] leading-[1.5] text-newTableText">{f.tagline}</span>
              </span>
              <span className="shrink-0 px-[14px] h-[40px] rounded-[10px] bg-btnPrimary text-white flex items-center">
                <span className="text-[16px] font-[600]">{t('fc_connect_btn', 'Connect')}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="flex flex-col items-center gap-[12px]">
          <button
            type="button"
            onClick={onMoreNetworks}
            className="text-btnPrimary hover:underline"
          >
            <span className="text-[16px] font-[500]">
              {t('fc_other_networks', 'Other networks (YouTube, X, Pinterest and more)')}
            </span>
          </button>
          <p className="flex items-center gap-[8px] text-[15px] leading-[1.6] text-newTableText text-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {t('fc_easy_secure', 'Your password stays with the network. We never see it and never store it.')}
          </p>
        </div>
      </div>
    </div>
  );
};
