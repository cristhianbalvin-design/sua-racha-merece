import { supabase } from "@/lib/supabase";

export const cpfDigits = (value: string) => value.replace(/\D/g, "").slice(0, 11);
export function maskCpf(value: string): string {
  const d = cpfDigits(value);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function isValidCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let n = 9; n <= 10; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}
export async function saveCpf(value: string): Promise<void> {
  const { error } = await supabase.rpc("set_my_cpf", { p_cpf: cpfDigits(value) });
  if (error) throw error;
}
export async function getMaskedCpf(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_my_cpf_masked");
  if (error) throw error;
  return data as string | null;
}
