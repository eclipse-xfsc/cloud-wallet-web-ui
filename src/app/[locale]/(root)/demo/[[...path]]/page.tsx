import { notFound } from 'next/navigation';
import DemoWallet from '@/components/demo/DemoWallet';
export const dynamic = 'force-dynamic';
export default function DemoPage({ params }: { params: { path?: string[] } }): JSX.Element {
  if (process.env.MOCK_MODE !== 'true') notFound();
  return <DemoWallet path={params.path ?? []} />;
}
