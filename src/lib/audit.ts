export function getCurrentUserId(): string | null {
  return localStorage.getItem('siap_user_id');
}
