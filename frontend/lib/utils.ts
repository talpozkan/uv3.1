import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(value: string): string {
  if (!value) return "";

  // Sadece rakamları ve baştaki + işaretini tut
  let cleaned = value.replace(/[^\d+]/g, '');

  // Eğer giriş sadece "+" veya boşsa olduğu gibi bırak
  if (cleaned === '+' || cleaned === '') return cleaned;

  if (cleaned.startsWith('+90')) {
    const digits = cleaned.slice(3).replace(/\D/g, '');

    // Eğer sadece +90 varsa ve kullanıcı bir şey eklemediyse 
    // (veya siliyorsa) boşluk zorlamayı bırakıyoruz.
    if (digits.length === 0) {
      return cleaned;
    }

    let formatted = '+90 ';
    if (digits.length > 0) {
      formatted += digits.substring(0, 3);
    }
    if (digits.length > 3) {
      formatted += ' ' + digits.substring(3, 6);
    }
    if (digits.length > 6) {
      formatted += ' ' + digits.substring(6, 8);
    }
    if (digits.length > 8) {
      formatted += ' ' + digits.substring(8, 10);
    }
    return formatted.trimEnd();
  }

  // Diğer ülke kodları için (+44, +49 vb.) temizlenmiş hali döndür
  return cleaned;
}
