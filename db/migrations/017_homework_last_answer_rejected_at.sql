-- Öğrenci cevabı havuza iade ettiğinde zaman damgası (UI); yeni üstlenmede sıfırlanır, yeni cevapta temizlenir.

ALTER TABLE student_homework_posts
  ADD COLUMN IF NOT EXISTS last_answer_rejected_at TIMESTAMPTZ;

COMMENT ON COLUMN student_homework_posts.last_answer_rejected_at IS
  'Öğrenci son öğretmen cevabını iade ettiğinde dolar; başka öğretmen üstlendiğinde veya yeni cevap gönderildiğinde temizlenir.';
