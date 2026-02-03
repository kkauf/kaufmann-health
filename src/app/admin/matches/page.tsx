import { redirect } from 'next/navigation';

// Deprecated: match workflow is handled in the leads page.
// Redirect any bookmarks/links to /admin/leads.
export default function AdminMatchesPage() {
  redirect('/admin/leads');
}
