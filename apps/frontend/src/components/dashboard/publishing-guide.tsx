'use client';

import Link from 'next/link';
import { useT } from '@postmill-ai/react/translation/get.transation.service.client';

export function PublishingGuide({ connected, canConnect, canCreate, canReadPosts }: {
  connected: boolean | undefined;
  canConnect: boolean;
  canCreate: boolean;
  canReadPosts: boolean;
}) {
  const t = useT();
  const steps = [
    {
      title: t('easy_connect_title', 'Connect an account'),
      description: connected
        ? t('easy_connected_body', 'Your account is connected. You can create a post.')
        : t('easy_connect_body', 'Choose Facebook or Instagram and follow the instructions.'),
      action: connected ? t('easy_accounts', 'View accounts') : t('easy_connect_action', 'Connect my account'),
      href: '/settings/channels', allowed: canConnect, complete: connected === true,
    },
    {
      title: t('easy_create_title', 'Prepare your post'),
      description: t('easy_create_body', 'Write a few words and add a photo or video. You can save a draft.'),
      action: t('easy_create_action', 'Create a post'),
      href: '/posts/post', allowed: canCreate, complete: false,
    },
    {
      title: t('easy_schedule_title', 'Choose when to publish'),
      description: t('easy_schedule_body', 'Publish now or choose a date. Follow the result in your calendar.'),
      action: t('easy_schedule_action', 'Open my calendar'),
      href: '/posts', allowed: canReadPosts, complete: false,
    },
  ];

  return (
    <section className="publishing-guide" aria-labelledby="publishing-guide-title">
      <div className="studio-card-heading">
        <h2 id="publishing-guide-title">{t('easy_guide_title', 'Your next post, in three simple steps')}</h2>
        <span className="text-newTableText text-sm">{t('easy_guide_hint', 'Start here. No technical experience needed.')}</span>
      </div>
      <ol className="publishing-guide-steps">
        {steps.map((step, index) => (
          <li key={step.href} className="publishing-guide-step bg-newBgColorInner border border-newTableBorder">
            <span className="publishing-guide-number bg-studioLime text-studioForest" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{step.title}</h3>
              {step.complete && <span className="text-positive text-sm">{t('easy_connected_status', 'Connected')}</span>}
              <p className="text-newTableText">{step.description}</p>
              {step.allowed && <Link className="publishing-guide-action text-btnPrimaryAccent" href={step.href}>{step.action}<span aria-hidden="true"> →</span></Link>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
