'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { Button } from '@postmill-ai/react/form/button';
import { useT } from '@postmill-ai/react/translation/get.transation.service.client';
import { useUser } from '@postmill-ai/frontend/components/layout/user.context';
import { usePermissions } from '@postmill-ai/frontend/components/layout/use-permissions';
import { getTimezone } from '@postmill-ai/frontend/components/layout/set.timezone';
import { useAddProvider } from '@postmill-ai/frontend/components/launches/add.provider.component';
import { useToaster } from '@postmill-ai/react/toaster/toaster';
import { CalendarIcon, PlusIcon } from '@postmill-ai/frontend/components/ui/icons';
import { ErrorState } from '@postmill-ai/frontend/components/analytics/kit/states';
import { useDashboardSummary } from './hooks/useDashboardSummary';
import { greetingForUser } from './dashboard.utils';
import './studio-dashboard.scss';

export { greetingForUser };

const AdvancedDashboard = dynamic(() => import('./advanced-dashboard').then((m) => m.AdvancedDashboard));

export const DashboardComponent = () => {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const permissions = usePermissions();
  const toaster = useToaster();
  const { data: summary, error, isLoading, mutate } = useDashboardSummary();
  const refresh = useCallback(() => { void mutate(); }, [mutate]);
  const addProvider = useAddProvider(refresh);
  const [connecting, setConnecting] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const canCreate = !permissions.isResolved || permissions.hasPermission('posts', 'create');
  const canConnect = !permissions.isResolved || permissions.hasPermission('channels', 'create');
  const canReadPosts = !permissions.isResolved || permissions.hasPermission('posts', 'read');
  const canReadMedia = !permissions.isResolved || permissions.hasPermission('media', 'read');
  const now = dayjs().tz(getTimezone());
  const firstName = user?.profile?.name?.trim().split(/\s+/)[0] || t('studio_friend', 'there');
  const newPost = () => router.push('/posts/post');
  const connect = async () => {
    setConnecting(true);
    try { await addProvider(); }
    catch { toaster.show(t('studio_connect_error', 'Could not load networks. Please try again.'), 'warning'); }
    finally { setConnecting(false); }
  };
  const stats = [
    { label: t('studio_scheduled', 'Scheduled posts'), value: summary?.scheduledPosts, hint: t('studio_ready', 'Ready to go live'), icon: '◷' },
    { label: t('studio_drafts', 'Drafts'), value: summary?.drafts, hint: t('studio_ideas', 'Ideas waiting for you'), icon: '✎' },
    { label: t('studio_channels', 'Connected networks'), value: summary?.channelsConnected, hint: t('studio_one_place', 'All in one place'), icon: '↗' },
    { label: t('studio_total', 'Total posts'), value: summary?.totalPosts, hint: t('studio_your_content', 'Your content, organized'), icon: '▤' },
  ];

  return (
    <main className="studio-dashboard w-full min-w-0 text-textColor">
      <header className="studio-heading">
        <div>
          <div className="studio-eyebrow text-newTableText">{t('studio_workspace', 'YOUR CONTENT STUDIO')} <span className="text-positive">●</span></div>
          <h1>{greetingForUser(firstName, now.hour(), t)}<span className="text-positive">.</span></h1>
          <p className="text-newTableText">{t('studio_subtitle', 'A little planning. A lot more room to create.')}</p>
        </div>
        <div className="studio-heading-actions">
          <span className="studio-date text-newTableText"><CalendarIcon aria-hidden="true" />{now.format('D MMMM YYYY')}</span>
          {canCreate && <Button onClick={newPost} innerClassName="gap-2"><PlusIcon />{t('studio_new_post', 'Create a post')}</Button>}
        </div>
      </header>

      {error ? <ErrorState title={t('studio_load_error', 'Could not load your workspace')} onRetry={() => void mutate()} /> : (
        <section className="studio-stats" aria-label={t('studio_overview', 'Workspace overview')} aria-busy={isLoading}>
          {stats.map((stat) => (
            <div className="studio-stat" key={stat.label}>
              <div><p className="text-newTableText">{stat.label}</p><strong>{isLoading || !summary ? '—' : (stat.value ?? 0).toLocaleString('he-IL')}</strong><small className="text-newTableText">{stat.hint}</small></div>
              <span className="studio-stat-icon text-positive bg-positive/10" aria-hidden="true">{stat.icon}</span>
            </div>
          ))}
        </section>
      )}

      <div className="studio-ribbon bg-newBgColorInner">
        <span className="studio-ribbon-badge bg-positive text-newBgColor">{t('studio_simple', 'SIMPLY CREATE')}</span>
        <span>{t('studio_ribbon', 'Your next great post starts here')}</span>
        <span className="text-newTableText studio-ribbon-end">{t('studio_ribbon_steps', 'Create · Schedule · Share')}</span>
      </div>

      <div className="studio-main-grid">
        <section className="studio-hero">
          <Image src="/images/content-studio.jpg" alt="" fill priority sizes="(max-width: 800px) 100vw, 65vw" className="object-cover" />
          <div className="studio-hero-shade" />
          <span className="studio-hero-chip">{t('studio_made_for_you', 'MORE SPACE FOR YOUR IDEAS')}</span>
          <div className="studio-hero-copy">
            <span className="studio-eyebrow">{t('studio_hero_eyebrow', 'FROM IDEA TO POST')}</span>
            <h2>{t('studio_hero_title', 'Good content.\nPerfect timing.')}</h2>
            <p>{t('studio_hero_body', 'Upload a photo or video, add a few words, and choose when to share. We will take it from there.')}</p>
            {canCreate && <Button onClick={newPost} className="studio-hero-button" innerClassName="gap-3">{t('studio_start', 'Let’s create a post')}<span aria-hidden="true">←</span></Button>}
          </div>
          <span className="studio-hero-caption">{t('studio_your_rhythm', 'YOUR CONTENT. YOUR RHYTHM.')}</span>
        </section>

        <aside className="studio-networks bg-newBgColorInner border border-newTableBorder">
          <div className="studio-card-heading"><h2>{t('studio_networks_title', 'Your networks')}</h2><span className="text-positive">↗</span></div>
          <p className="text-newTableText">{t('studio_networks_body', 'One connection. All your content in one place.')}</p>
          <div className="studio-platforms" aria-hidden="true">
            {['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'pinterest'].map((id) => <span key={id} className="bg-newBgColor"><Image src={`/icons/platforms/${id}.png`} alt="" width={31} height={31} /></span>)}
          </div>
          <div className="studio-connection-status">
            <span className={summary?.channelsConnected ? 'text-positive' : 'text-newTableText'}>●</span>
            <strong>{summary ? (summary.channelsConnected ? t('studio_connected_count', '{{count}} networks connected', { count: summary.channelsConnected }) : t('studio_not_connected', 'No networks connected yet')) : t('loading', 'Loading...')}</strong>
          </div>
          <p className="text-newTableText studio-small">{t('studio_networks_hint', 'Choose a network and approve access to your account. Your password stays with the network.')}</p>
          {canConnect && <Button onClick={connect} loading={connecting} innerClassName="gap-2" className="w-full"><PlusIcon />{t('studio_connect', 'Connect a network')}</Button>}
          <Link href="/posts" className="studio-text-link text-newTableText">{t('studio_manage_networks', 'Manage connected accounts')} <span aria-hidden="true">←</span></Link>
        </aside>
      </div>

      <div className="studio-bottom-grid">
        {canReadPosts && <section className="studio-schedule bg-newBgColorInner border border-newTableBorder">
          <div className="studio-card-heading"><h2>{t('studio_up_next', 'Coming up next')}</h2><Link href="/posts" className="text-newTableText">{t('studio_full_calendar', 'Full calendar')} <span aria-hidden="true">←</span></Link></div>
          <div className="studio-week" aria-label={t('studio_this_week', 'This week')}>
            {Array.from({ length: 7 }, (_, index) => {
              const date = now.add(index, 'day');
              const count = summary?.upcomingPosts.filter((post) => dayjs(post.publishDate).tz(getTimezone()).isSame(date, 'day')).length || 0;
              return <Link key={index} href={`/posts?date=${date.format('YYYY-MM-DD')}`} className={index === 0 ? 'studio-day studio-day-today' : 'studio-day'} aria-label={date.format('dddd, D MMMM')}><span>{date.format('ddd')}</span><strong>{date.format('D')}</strong><i className={count ? 'bg-positive' : 'bg-newTableBorder'} /></Link>;
            })}
          </div>
          {isLoading ? <div className="h-20 animate-pulse bg-newTableHeader rounded-xl" /> : error ? <p className="text-dangerText">{t('studio_schedule_error', 'Schedule unavailable. Try again above.')}</p> : summary?.upcomingPosts.length ? (
            <div className="studio-upcoming-list">{summary.upcomingPosts.slice(0, 3).map((post) => <Link href={`/posts?post=${encodeURIComponent(post.id)}`} key={post.id} className="studio-upcoming border-newTableBorder"><time className="text-positive" dateTime={post.publishDate}>{dayjs(post.publishDate).tz(getTimezone()).format('DD/MM · HH:mm')}</time><span className="truncate">{post.content?.replace(/<[^>]*>/g, '') || t('studio_media_post', 'Photo or video post')}</span><small className="text-newTableText">{post.channelName}</small></Link>)}</div>
          ) : <div className="studio-schedule-empty"><span className="studio-empty-symbol text-positive" aria-hidden="true">◷</span><div><strong>{t('studio_calendar_empty', 'Your calendar is ready for its first post')}</strong><p className="text-newTableText">{t('studio_calendar_hint', 'Choose a time that works for you. We will handle the publishing.')}</p></div>{canCreate && <Button secondary onClick={newPost}>{t('studio_schedule_first', 'Schedule a post')}</Button>}</div>}
        </section>}

        <section className="studio-quick bg-newBgColorInner border border-newTableBorder">
          <div className="studio-card-heading"><h2>{t('studio_shortcuts', 'A good place to start')}</h2><span className="text-positive">✧</span></div>
          {canCreate && <Link href="/posts/post" className="studio-shortcut"><span className="studio-shortcut-icon bg-positive/10 text-positive">01</span><div><strong>{t('studio_write', 'Create your next post')}</strong><p className="text-newTableText">{t('studio_write_hint', 'Photo, video, or just a great idea')}</p></div><span aria-hidden="true">↖</span></Link>}
          {canReadMedia && <Link href="/files" className="studio-shortcut"><span className="studio-shortcut-icon bg-btnPrimary/10 text-btnPrimaryAccent">02</span><div><strong>{t('studio_media', 'Your media library')}</strong><p className="text-newTableText">{t('studio_media_hint', 'Upload once. Use whenever you like.')}</p></div><span aria-hidden="true">↖</span></Link>}
          {canReadPosts && <Link href="/posts" className="studio-shortcut"><span className="studio-shortcut-icon bg-priorityMedium/10 text-priorityMedium">03</span><div><strong>{t('studio_plan', 'Plan the week ahead')}</strong><p className="text-newTableText">{t('studio_plan_hint', 'A clear view of everything coming up')}</p></div><span aria-hidden="true">↖</span></Link>}
        </section>
      </div>
      <footer className="studio-footer text-newTableText"><span>{t('studio_footer', 'Less busywork. More creativity.')}</span><Button secondary onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced} aria-controls="advanced-dashboard">{advanced ? t('studio_hide_advanced', 'Hide advanced overview') : t('studio_show_advanced', 'More insights and tools')}</Button></footer>
      {advanced && <div id="advanced-dashboard"><AdvancedDashboard /></div>}
    </main>
  );
};
