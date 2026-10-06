// The four networks our customers actually market on. They get a featured
// spot in every channel picker and a plain-language setup guide that replaces
// the adapter's developer-oriented English steps. Every other provider stays
// available under "More networks".

type T = (key: string, fallback: string, vars?: Record<string, unknown>) => string;

export interface FeaturedChannel {
  identifier: string;
  title: string;
  tagline: string;
  // Variant of the same network (e.g. LinkedIn company page vs. profile).
  alternative?: { identifier: string; label: string };
}

export interface ChannelGuide {
  steps: string[];
  fields: Record<string, { label: string; help: string }>;
  callbackHelp: string;
  note?: string;
  // The network refuses plain-http callback URLs (local installs).
  requiresHttps?: boolean;
}

export const FEATURED_IDENTIFIERS = [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin-page',
  // Variants reached from a featured card.
  'instagram-standalone',
  'linkedin',
];

export const isFeatured = (identifier: string) =>
  FEATURED_IDENTIFIERS.includes(identifier);

export const featuredChannels = (t: T): FeaturedChannel[] => [
  {
    identifier: 'facebook',
    title: 'Facebook',
    tagline: t('fc_facebook_tagline', "Post to your business's Facebook Page"),
  },
  {
    identifier: 'instagram',
    title: 'Instagram',
    tagline: t('fc_instagram_tagline', 'A business Instagram account linked to a Facebook Page'),
    alternative: {
      identifier: 'instagram-standalone',
      label: t('fc_instagram_alt', 'No Facebook Page? Connect Instagram directly'),
    },
  },
  {
    identifier: 'tiktok',
    title: 'TikTok',
    tagline: t('fc_tiktok_tagline', 'Upload videos to your TikTok account'),
  },
  {
    identifier: 'linkedin-page',
    title: 'LinkedIn',
    tagline: t('fc_linkedin_tagline', 'Post to your company page on LinkedIn'),
    alternative: {
      identifier: 'linkedin',
      label: t('fc_linkedin_alt', 'Personal profile instead of a company page'),
    },
  },
];

const metaFields = (t: T) => ({
  clientId: {
    label: t('fc_meta_app_id', 'App ID'),
    help: t('fc_meta_app_id_help', 'In your app: App settings → Basic. A long number.'),
  },
  clientSecret: {
    label: t('fc_meta_app_secret', 'App Secret'),
    help: t('fc_meta_app_secret_help', 'On the same screen, click "Show" next to App Secret and copy it.'),
  },
  configId: {
    label: t('fc_meta_config_id', 'Configuration ID'),
    help: t('fc_meta_config_id_help', 'Usually leave empty. Only needed if your app uses "Facebook Login for Business".'),
  },
});

const linkedinFields = (t: T) => ({
  clientId: {
    label: t('fc_li_client_id', 'Client ID'),
    help: t('fc_li_client_id_help', 'In your app: the Auth tab, under Application credentials.'),
  },
  clientSecret: {
    label: t('fc_li_client_secret', 'Primary Client Secret'),
    help: t('fc_li_client_secret_help', 'Same place — click the eye icon to reveal and copy it.'),
  },
});

export const channelGuide = (t: T, identifier: string): ChannelGuide | null => {
  const devModeNote = t(
    'fc_meta_dev_mode_note',
    'The app can stay in Development mode — that is enough to connect Pages and accounts you manage yourself.'
  );
  switch (identifier) {
    case 'facebook':
      return {
        steps: [
          t('fc_fb_s1', 'Open Meta for Developers (link above) and log in with the Facebook account that manages your Page.'),
          t('fc_fb_s2', 'Click "Create App". When asked what the app is for, choose the Business / manage a Page option.'),
          t('fc_fb_s3', 'Inside the app, add the "Facebook Login" product.'),
          t('fc_fb_s4', 'In Facebook Login → Settings, paste the return address below into "Valid OAuth Redirect URIs" and save.'),
          t('fc_fb_s5', 'In App settings → Basic, copy the App ID and App Secret into the fields below.'),
          t('fc_fb_s6', 'Click "Save and connect", approve in the Facebook window and pick your Page.'),
        ],
        fields: metaFields(t),
        callbackHelp: t('fc_meta_callback_help', 'Paste this in Facebook Login → Settings → "Valid OAuth Redirect URIs".'),
        note: devModeNote,
      };
    case 'instagram':
      return {
        steps: [
          t('fc_ig_s1', 'Make sure your Instagram account is a professional account (Business or Creator) and is linked to your Facebook Page.'),
          t('fc_ig_s2', 'Already set up Facebook? Use the same Meta app — the same App ID and App Secret.'),
          t('fc_ig_s3', 'If not: open Meta for Developers, create an app and add "Facebook Login" (as in the Facebook guide).'),
          t('fc_ig_s4', 'In Facebook Login → Settings, paste the return address below into "Valid OAuth Redirect URIs" and save.'),
          t('fc_ig_s5', 'Copy the App ID and App Secret into the fields below and click "Save and connect".'),
        ],
        fields: metaFields(t),
        callbackHelp: t('fc_meta_callback_help', 'Paste this in Facebook Login → Settings → "Valid OAuth Redirect URIs".'),
        note: devModeNote,
      };
    case 'instagram-standalone':
      return {
        steps: [
          t('fc_igs_s1', 'Make sure your Instagram account is a professional account (Business or Creator).'),
          t('fc_igs_s2', 'Open Meta for Developers, click "Create App" and choose the Business option.'),
          t('fc_igs_s3', 'Add the "Instagram" product and choose "API setup with Instagram Login".'),
          t('fc_igs_s4', 'Under "Business login settings", paste the return address below into the OAuth redirect URIs list.'),
          t('fc_igs_s5', 'Copy the Instagram App ID and Instagram App Secret from that screen into the fields below.'),
          t('fc_igs_s6', 'Click "Save and connect" and approve in the Instagram window.'),
        ],
        fields: {
          clientId: {
            label: t('fc_igs_app_id', 'Instagram App ID'),
            help: t('fc_igs_app_id_help', 'Instagram → API setup with Instagram Login. Not the regular App ID!'),
          },
          clientSecret: {
            label: t('fc_igs_app_secret', 'Instagram App Secret'),
            help: t('fc_igs_app_secret_help', 'Same screen, right below the Instagram App ID.'),
          },
        },
        callbackHelp: t('fc_igs_callback_help', 'Paste this under Business login settings → OAuth redirect URIs.'),
        note: devModeNote,
      };
    case 'tiktok':
      return {
        steps: [
          t('fc_tt_s1', 'Open TikTok for Developers (link above), log in and go to "Manage apps" → "Connect an app".'),
          t('fc_tt_s2', 'Add the products "Login Kit" and "Content Posting API".'),
          t('fc_tt_s3', 'Under "Platforms" tick "Web", and in Login Kit paste the return address below as the Redirect URI.'),
          t('fc_tt_s4', 'Copy the Client key and Client secret from "Basic information" into the fields below.'),
          t('fc_tt_s5', 'Click "Save and connect" and approve in the TikTok window.'),
        ],
        fields: {
          clientId: {
            label: t('fc_tt_client_key', 'Client key'),
            help: t('fc_tt_client_key_help', 'In your app: "Basic information", at the top of the page.'),
          },
          clientSecret: {
            label: t('fc_tt_client_secret', 'Client secret'),
            help: t('fc_tt_client_secret_help', 'Same place, right below the Client key.'),
          },
        },
        callbackHelp: t('fc_tt_callback_help', 'Paste this in Login Kit → Web → Redirect URI.'),
        note: t('fc_tt_note', 'TikTok checks a new app before it can publish publicly. Until it is approved, posts are saved as private (only you can see them).'),
        requiresHttps: true,
      };
    case 'linkedin-page':
    case 'linkedin':
      return {
        steps: [
          t('fc_li_s1', 'Open the LinkedIn Developer Portal (link above) and click "Create app". Link it to your company page (you must be its admin).'),
          identifier === 'linkedin-page'
            ? t('fc_li_s2_page', 'On the "Products" tab, request "Sign In with LinkedIn using OpenID Connect", "Share on LinkedIn" and "Community Management API".')
            : t('fc_li_s2', 'On the "Products" tab, request "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn".'),
          t('fc_li_s3', 'On the "Auth" tab, under "Authorized redirect URLs for your app", paste the return address below and save.'),
          t('fc_li_s4', 'From the same tab, copy the Client ID and Primary Client Secret into the fields below.'),
          identifier === 'linkedin-page'
            ? t('fc_li_s5_page', 'Click "Save and connect", sign in to LinkedIn and pick the company page.')
            : t('fc_li_s5', 'Click "Save and connect" and sign in to LinkedIn.'),
        ],
        fields: linkedinFields(t),
        callbackHelp: t('fc_li_callback_help', 'Paste this in the Auth tab → "Authorized redirect URLs for your app".'),
      };
    default:
      return null;
  }
};
