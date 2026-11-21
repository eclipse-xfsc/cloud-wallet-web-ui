/** Keep the current flow and its opaque request URI when switching languages. */
export function languageLocation(path: string, search: string, hash: string, language: string): string {
  if (!['de', 'en'].includes(language)) throw new Error('Unsupported language');
  const localize = (value: string): string => value.replace(/^\/(de|en)(?=\/|$)/, `/${language}`);
  const query = new URLSearchParams(search);
  const next = query.get('next');
  if (next && /^\/(de|en)\//.test(next)) query.set('next', localize(next));
  return `${localize(path)}${query.size ? `?${query.toString()}` : ''}${hash}`;
}
