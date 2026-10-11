'use client';
import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@postmill-ai/helpers/utils/custom.fetch';
import { useParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { ExistingDataContextProvider } from '@postmill-ai/frontend/components/launches/helpers/use.existing.data';
import { Integrations } from '@postmill-ai/frontend/components/launches/calendar.context';
import { Composer } from '@postmill-ai/frontend/components/composer/composer';
import { LoadingComponent } from '@postmill-ai/frontend/components/layout/loading';
import { EmptyState } from '@postmill-ai/frontend/components/ui/empty-state';
import { Button } from '@postmill-ai/react/form/button';
import { useT } from '@postmill-ai/react/translation/get.transation.service.client';
import { ErrorState } from '@postmill-ai/frontend/components/analytics/kit/states';

export default function EditPostPage() {
  const fetch = useFetch();
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const groupId = params.id as string;

  const loadIntegrations = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load channels (${response.status})`);
    return (await response.json()).integrations;
  }, [fetch]);

  const loadPost = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not load post (${response.status})`);
    return await response.json();
  }, [fetch]);

  const {
    data: integrations,
    isLoading: integrationsLoading,
    error: integrationsError,
    mutate: reloadIntegrations,
  } = useSWR<
    Integrations[]
  >('/integrations/list', loadIntegrations,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      fallbackData: [],
    }
  );

  const {
    data: postData,
    isLoading: postLoading,
    error: postError,
    mutate: reloadPost,
  } = useSWR(
    groupId ? `/posts/group/${groupId}` : null,
    loadPost,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  if (integrationsError || postError) {
    return (
      <ErrorState
        title={t('failed_to_load_post_details', 'Could not load post details')}
        message={t('please_try_again_later', 'Please try again later.')}
        onRetry={() => {
          void reloadIntegrations();
          void reloadPost();
        }}
      />
    );
  }

  if (integrationsLoading || postLoading) {
    return <LoadingComponent />;
  }

  // Never blank-page: a deleted post or a since-disconnected channel both
  // used to render `null` with no way out.
  if (!postData?.posts?.length) {
    return (
      <div className="flex justify-center p-[40px]">
        <EmptyState
          className="w-full max-w-[480px]"
          title={t('post_not_found_title', 'Post not found')}
          description={t(
            'post_not_found_desc',
            'This post may have been deleted or you may not have access to it.'
          )}
          action={
            <Button onClick={() => router.push('/posts')}>
              {t('back_to_posts', 'Back to posts')}
            </Button>
          }
        />
      </div>
    );
  }

  const postIntegrations = (integrations || []).filter((item) => item.id === postData.integration);
  if (!postIntegrations.length) {
    return (
      <div className="flex justify-center p-[40px]">
        <EmptyState
          className="w-full max-w-[480px]"
          title={t('channel_disconnected_click_to_reconnect', 'This account is disconnected. Connect it again.')}
          description={t(
            'composer_no_channels_desc',
            'Connect a channel to start composing and scheduling posts.'
          )}
          action={
            <Button onClick={() => router.push('/settings/channels')}>
              {t('manage_channels', 'Manage channels')}
            </Button>
          }
        />
      </div>
    );
  }

  const publishDate = dayjs
    .utc(postData.posts[0].publishDate)
    .local();

  return (
    <ExistingDataContextProvider value={postData}>
      <Composer
        integrations={postIntegrations}
        allIntegrations={integrations}
        date={publishDate}
      />
    </ExistingDataContextProvider>
  );
}
