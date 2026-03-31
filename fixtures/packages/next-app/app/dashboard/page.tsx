// Intentional: route segment has no loading or error boundary files.
// This triggers the next-missing-boundaries check.
import { formatTitle } from '../utils/format';

export default function DashboardPage() {
  return <div>{formatTitle('dashboard')}</div>;
}
