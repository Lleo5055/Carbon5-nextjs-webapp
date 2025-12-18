'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

type Props = {
  id: string;
  month: string;
};

export default function Scope3DeleteButton({ id, month }: Props) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Delete this Scope 3 activity?')) return;

    // get user for audit
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('You must be signed in.');
      return;
    }

    // delete scope 3 row
    const { error } = await supabase
      .from('scope3_activities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete Scope 3 activity:', error);
      alert('Could not delete entry.');
      return;
    }

    // ✅ AUDIT EVENT
    await supabase.from('edit_history').insert({
      user_id: user.id,
      month,
      entity: 'scope3',
      entity_id: id,
      action: 'delete',
    });

    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      className="h-[28px] px-3 rounded-full border text-[11px] bg-white text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white transition font-medium"
    >
      Delete
    </button>
  );
}
