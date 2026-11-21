import { redirect } from 'next/navigation';
export default function Settings({ params }: { params: { locale: string } }): never {
  redirect(`/${params.locale}/wallet`);
}
