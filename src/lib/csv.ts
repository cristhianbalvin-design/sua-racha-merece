import type { User } from '@/data/mockData';

const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildUsersCsv = (users: User[]): string => {
  const rows = users.map((user) => [
    user.name,
    user.email || '',
    user.city,
    user.country,
    user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '',
  ]);

  return [
    ['Nome', 'Email', 'Cidade', 'Estado', 'Data de registro'],
    ...rows,
  ].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
};
