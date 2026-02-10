export type TwitterTriggerType =
  | 'on_tweet'
  | 'on_mention'
  | 'on_keyword'
  | 'on_hashtag'
  | 'on_search'
  | 'on_retweet'
  | 'on_like';

type TwitterTriggerFilters = {
  triggerType?: TwitterTriggerType;
  triggerValue?: string;
  excludeReplies?: boolean;
  excludeRetweets?: boolean;
  excludeQuotes?: boolean;
  originalOnly?: boolean;
};

export function buildTwitterQuery(username: string | undefined, filters?: TwitterTriggerFilters) {
  const triggerType = (filters?.triggerType || 'on_tweet') as TwitterTriggerType;
  const rawValue = String(filters?.triggerValue || '').trim();

  let base = '';
  if (triggerType === 'on_mention') {
    if (!username) return null;
    base = `@${username}`;
  } else if (triggerType === 'on_keyword' || triggerType === 'on_search') {
    if (!rawValue) return null;
    base = rawValue;
  } else if (triggerType === 'on_hashtag') {
    if (!rawValue) return null;
    base = rawValue.startsWith('#') ? rawValue : `#${rawValue}`;
  } else if (triggerType === 'on_retweet') {
    if (!username) return null;
    base = `from:${username} is:retweet`;
  } else if (triggerType === 'on_like') {
    return null;
  } else {
    if (!username) return null;
    base = `from:${username}`;
  }

  const parts = [base];
  const excludeReplies = Boolean(filters?.excludeReplies || filters?.originalOnly);
  const excludeRetweets = Boolean(filters?.excludeRetweets || filters?.originalOnly);
  const excludeQuotes = Boolean(filters?.excludeQuotes || filters?.originalOnly);

  if (excludeReplies) parts.push('-is:reply');
  if (excludeRetweets && triggerType !== 'on_retweet') parts.push('-is:retweet');
  if (excludeQuotes) parts.push('-is:quote');

  return parts.join(' ');
}

export function requiresTriggerValue(triggerType?: TwitterTriggerType) {
  return triggerType === 'on_keyword' || triggerType === 'on_hashtag' || triggerType === 'on_search';
}
