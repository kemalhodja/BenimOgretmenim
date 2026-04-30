/** API `homework_post_status` enum değerleri → kullanıcıya kısa Türkçe etiket */
export function homeworkPostStatusLabelTr(status: string): string {
  switch (status) {
    case "open":
      return "Havuzda";
    case "claimed":
      return "Üstlenildi";
    case "answered":
      return "Cevaplandı";
    case "closed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
    default:
      return status;
  }
}
