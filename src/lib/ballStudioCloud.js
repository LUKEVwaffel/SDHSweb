export const CLOUD_DECK_PREFIX = 'ball_presentation:';
// Compare-and-swap prevents one device from silently overwriting another.
export async function saveStudioCloud(client, deck, account) {
  const updatedAt = new Date(Math.max(Date.now(), (Date.parse(deck.cloudRevision) || 0) + 1)).toISOString();
  const row = { value: deck, updated_by: account || null, updated_at: updatedAt };
  let result;
  if (deck.cloudRevision) {
    result = await client.from('admin_settings').update(row).eq('key', CLOUD_DECK_PREFIX + deck.id).eq('updated_at', deck.cloudRevision).select('updated_at');
    if (!result.error && result.data.length !== 1) throw new Error('This deck changed on another device. Open its cloud version, or duplicate your local deck and save it separately.');
  } else {
    result = await client.from('admin_settings').insert({ key: CLOUD_DECK_PREFIX + deck.id, ...row }).select('updated_at');
  }
  if (result.error) throw new Error(`Cloud save failed: ${result.error.message}. Your browser copy is still available.`);
  return updatedAt;
}
