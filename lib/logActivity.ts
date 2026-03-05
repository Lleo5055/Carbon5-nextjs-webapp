import { supabase } from './supabaseClient';

/**
 * Log an activity event to activity_log.
 * Browser-side only. Never throws — logging must not break the calling action.
 */
export async function logActivity(
  action: string,
  resource: string,
  detail: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Resolve owner_id: use team owner if this user is a team member
    let ownerId = user.id;
    const { data: membership } = await supabase
      .from('team_members')
      .select('owner_id')
      .eq('member_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membership?.owner_id) ownerId = membership.owner_id;

    // Resolve actor name
    const { data: profile } = await supabase
      .from('profiles')
      .select('contact_name')
      .eq('id', user.id)
      .maybeSingle();
    const actorName = profile?.contact_name || user.email || 'Unknown';

    const { error } = await supabase.from('activity_log').insert({
      owner_id: ownerId,
      actor_id: user.id,
      actor_name: actorName,
      action,
      resource,
      detail,
    });
    if (error) console.error('[logActivity] insert failed:', error);
  } catch (err) {
    console.error('[logActivity] exception:', err);
  }
}
