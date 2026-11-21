import { useParams } from 'react-router-dom';

export function useAdminBase(): string {
  const { sid } = useParams();
  return sid ? `/s/${sid}` : '/admin';
}
