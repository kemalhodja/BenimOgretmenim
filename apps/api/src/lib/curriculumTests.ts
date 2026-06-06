export type CurriculumChoice = {
  key: "A" | "B" | "C" | "D";
  text: string;
};

export type CurriculumQuestion = {
  id: string;
  gradeLevel: number;
  branchSlug: string;
  branchName: string;
  unitSlug: string;
  unitTitle: string;
  outcomeCode: string;
  outcomeTitle: string;
  prompt: string;
  choices: CurriculumChoice[];
  correctChoice: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  sortOrder: number;
  metadata: {
    skill: string;
    misconception: string;
    bloomLevel: "remember" | "understand" | "apply" | "analyze";
    estimatedSeconds: number;
    practiceHint: string;
  };
};

export type PublicCurriculumQuestion = Omit<CurriculumQuestion, "correctChoice" | "explanation">;

export type CurriculumUnit = {
  unitSlug: string;
  unitTitle: string;
  questionCount: number;
};

export type CurriculumBranch = {
  branchSlug: string;
  branchName: string;
  units: CurriculumUnit[];
};

export type CurriculumGrade = {
  gradeLevel: number;
  label: string;
  branches: CurriculumBranch[];
};

type BranchTemplate = {
  branchSlug: string;
  branchName: string;
  grades: number[];
  units: string[];
};

const CHOICE_KEYS: Array<CurriculumChoice["key"]> = ["A", "B", "C", "D"];

const BRANCH_TEMPLATES: BranchTemplate[] = [
  {
    branchSlug: "ilkokul-turkce",
    branchName: "Türkçe",
    grades: [1, 2, 3, 4],
    units: ["Okuma Anlama", "Dil Bilgisi", "Yazma Becerisi"],
  },
  {
    branchSlug: "ilkokul-matematik",
    branchName: "Matematik",
    grades: [1, 2, 3, 4],
    units: ["Sayılar ve İşlemler", "Geometri", "Veri Okuma"],
  },
  {
    branchSlug: "ilkokul-hayat-bilgisi",
    branchName: "Hayat Bilgisi",
    grades: [1, 2, 3],
    units: ["Okulumuzda Hayat", "Evimizde Hayat", "Sağlıklı Hayat"],
  },
  {
    branchSlug: "ilkokul-fen-bilimleri",
    branchName: "Fen Bilimleri",
    grades: [3, 4],
    units: ["Canlılar Dünyası", "Maddeyi Tanıyalım", "Kuvvetin Etkileri"],
  },
  {
    branchSlug: "ilkokul-sosyal-bilgiler",
    branchName: "Sosyal Bilgiler",
    grades: [4],
    units: ["Birey ve Toplum", "Kültür ve Miras", "İnsanlar ve Yönetim"],
  },
  {
    branchSlug: "ilkokul-ingilizce",
    branchName: "İngilizce",
    grades: [2, 3, 4],
    units: ["Words and Greetings", "Daily Life", "Classroom Language"],
  },
  {
    branchSlug: "ortaokul-turkce",
    branchName: "Türkçe",
    grades: [5, 6, 7, 8],
    units: ["Sözcükte Anlam", "Cümlede Anlam", "Paragraf ve Metin"],
  },
  {
    branchSlug: "ortaokul-matematik",
    branchName: "Matematik",
    grades: [5, 6, 7, 8],
    units: ["Sayılar ve İşlemler", "Cebirsel İfadeler", "Geometri ve Ölçme"],
  },
  {
    branchSlug: "ortaokul-fen-bilimleri",
    branchName: "Fen Bilimleri",
    grades: [5, 6, 7, 8],
    units: ["Canlılar ve Yaşam", "Kuvvet ve Enerji", "Madde ve Değişim"],
  },
  {
    branchSlug: "ortaokul-sosyal-bilgiler",
    branchName: "Sosyal Bilgiler",
    grades: [5, 6, 7],
    units: ["Birey ve Toplum", "Kültür ve Miras", "Üretim ve Dağıtım"],
  },
  {
    branchSlug: "ortaokul-ingilizce",
    branchName: "İngilizce",
    grades: [5, 6, 7, 8],
    units: ["Vocabulary", "Reading", "Communication"],
  },
  {
    branchSlug: "ortaokul-dkab",
    branchName: "Din Kültürü ve Ahlak Bilgisi",
    grades: [5, 6, 7, 8],
    units: ["İnanç", "İbadet", "Ahlak"],
  },
  {
    branchSlug: "matematik",
    branchName: "Matematik",
    grades: [9, 10, 11, 12],
    units: ["Fonksiyonlar", "Denklemler", "Trigonometri", "Türev ve İntegral"],
  },
  {
    branchSlug: "edebiyat",
    branchName: "Türk Dili ve Edebiyatı",
    grades: [9, 10, 11, 12],
    units: ["Metin Türleri", "Şiir Bilgisi", "Roman ve Hikaye", "Dil Bilgisi"],
  },
  {
    branchSlug: "fizik",
    branchName: "Fizik",
    grades: [9, 10, 11, 12],
    units: ["Hareket ve Kuvvet", "Enerji", "Elektrik", "Dalgalar"],
  },
  {
    branchSlug: "kimya",
    branchName: "Kimya",
    grades: [9, 10, 11, 12],
    units: ["Atom ve Periyodik Sistem", "Kimyasal Türler", "Tepkimeler", "Çözeltiler"],
  },
  {
    branchSlug: "biyoloji",
    branchName: "Biyoloji",
    grades: [9, 10, 11, 12],
    units: ["Hücre", "Canlıların Sınıflandırılması", "Kalıtım", "Ekosistem"],
  },
  {
    branchSlug: "tarih",
    branchName: "Tarih",
    grades: [9, 10, 11, 12],
    units: ["Tarih Bilimi", "İlk ve Orta Çağ", "Osmanlı Tarihi", "Cumhuriyet Tarihi"],
  },
  {
    branchSlug: "cografya",
    branchName: "Coğrafya",
    grades: [9, 10, 11, 12],
    units: ["Doğal Sistemler", "Beşeri Sistemler", "Harita Bilgisi", "Küresel Ortam"],
  },
  {
    branchSlug: "ingilizce",
    branchName: "İngilizce",
    grades: [9, 10, 11, 12],
    units: ["Grammar", "Reading", "Vocabulary", "Writing"],
  },
  {
    branchSlug: "felsefe",
    branchName: "Felsefe",
    grades: [10, 11, 12],
    units: ["Felsefeye Giriş", "Bilgi Felsefesi", "Ahlak Felsefesi"],
  },
];

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UNIT_SKILLS: Record<string, { skill: string; misconception: string; context: string; action: string }> = {
  "Sayılar ve İşlemler": {
    skill: "işlem önceliği ve problem kurma",
    misconception: "Verilenleri okumadan ilk görülen işlemi yapmak",
    context: "bir kantin alışverişinde toplam tutarı ve para üstünü karşılaştırır",
    action: "verileri sıraya koyup doğru işlemi seçer",
  },
  Geometri: {
    skill: "şekil özelliklerini ayırt etme",
    misconception: "Kenar ve açı bilgisini yalnızca görünüme göre yorumlamak",
    context: "bir sınıf panosunun kenar ölçülerinden şekil özelliği çıkarır",
    action: "ölçüleri ilişkilendirip uygun geometrik özelliği belirtir",
  },
  "Veri Okuma": {
    skill: "tablo ve grafik yorumlama",
    misconception: "En büyük değeri bağlamı okumadan sonuç kabul etmek",
    context: "haftalık kitap okuma tablosundan sonuç çıkarır",
    action: "tablodaki veriyi karşılaştırıp kanıtlı yorum yapar",
  },
  "Sözcükte Anlam": {
    skill: "bağlamdan anlam çıkarma",
    misconception: "Kelimenin ilk akla gelen anlamını her cümleye uygulamak",
    context: "kısa bir metindeki altı çizili sözcüğün anlamını belirler",
    action: "sözcüğün cümlede kazandığı anlamı metin ipucuyla eşleştirir",
  },
  "Cümlede Anlam": {
    skill: "yargı ve çıkarım belirleme",
    misconception: "Metinde olmayan kişisel yorumu sonuç sanmak",
    context: "iki cümle arasındaki neden-sonuç ilişkisini değerlendirir",
    action: "verilen ifadeden çıkarılabilecek kesin yargıyı seçer",
  },
  "Paragraf ve Metin": {
    skill: "ana fikir ve yardımcı düşünce",
    misconception: "Metindeki ayrıntıyı ana fikirle karıştırmak",
    context: "kısa bir paragrafta yazarın asıl vurgusunu arar",
    action: "metnin bütününe uygun ana düşünceyi seçer",
  },
  "Canlılar ve Yaşam": {
    skill: "canlı özelliklerini sınıflandırma",
    misconception: "Tek bir özelliğe bakarak tüm sınıflandırmayı yapmak",
    context: "bir gözlem notundan canlıların ortak özelliklerini ayırır",
    action: "kanıta dayalı sınıflandırma yapar",
  },
  "Kuvvet ve Enerji": {
    skill: "neden-sonuç ilişkisi kurma",
    misconception: "Kuvvetin yönünü ve etkisini karıştırmak",
    context: "bir cismin hareketindeki değişimi yorumlar",
    action: "kuvvetin hareket üzerindeki etkisini doğru açıklar",
  },
  Fonksiyonlar: {
    skill: "değişkenler arası ilişki kurma",
    misconception: "Her tabloyu doğrusal ilişki sanmak",
    context: "iki değişkenli bir tabloyu fonksiyon ilişkisi açısından inceler",
    action: "girdi-çıktı ilişkisini tutarlı biçimde tanımlar",
  },
  Denklemler: {
    skill: "denklem kurma ve çözüm kontrolü",
    misconception: "Eşitliğin iki tarafını dengede tutmadan işlem yapmak",
    context: "yaş ve fiyat problemi için eşitlik kurar",
    action: "bilinmeyeni tanımlayıp çözümü yerine koyarak kontrol eder",
  },
  Trigonometri: {
    skill: "oranları uygun üçgende kullanma",
    misconception: "Sinüs, kosinüs ve tanjant oranlarını karıştırmak",
    context: "yükseklik ölçümü için dik üçgen oranı seçer",
    action: "verilen açıya göre doğru trigonometrik oranı kullanır",
  },
  "Türev ve İntegral": {
    skill: "değişim ve birikim yorumlama",
    misconception: "Türevi yalnızca formül ezberi olarak görmek",
    context: "hız-zaman grafiğinden değişim bilgisini yorumlar",
    action: "grafik ve cebirsel ifadeyi birlikte değerlendirir",
  },
};

function unitProfile(unitTitle: string): { skill: string; misconception: string; context: string; action: string } {
  return (
    UNIT_SKILLS[unitTitle] ?? {
      skill: `${unitTitle} kazanımını yorumlama`,
      misconception: "Kazanımı bağlamdan koparıp ezber cevap vermek",
      context: `${unitTitle} ile ilgili günlük bir öğrenme durumunu değerlendirir`,
      action: "verilen bilgiyi kazanımla ilişkilendirip gerekçeli karar verir",
    }
  );
}

function buildChoices(
  correctChoice: CurriculumChoice["key"],
  gradeLevel: number,
  unitTitle: string,
  sortOrder: number,
): CurriculumChoice[] {
  const profile = unitProfile(unitTitle);
  const correct = `${gradeLevel}. sınıf düzeyinde ${profile.action}; işlem/kanıt adımlarını kontrol eder.`;
  const distractors = [
    profile.misconception,
    "Sorunun verdiği bilgileri kullanmadan genel ve kanıtsız bir tahmin yapar.",
    `Kazanımı ${sortOrder % 2 === 0 ? "önceki" : "sonraki"} üniteyle karıştırarak eksik sonuca ulaşır.`,
  ];
  let distractorIndex = 0;
  return CHOICE_KEYS.map((key) => {
    if (key === correctChoice) return { key, text: correct };
    const text = distractors[distractorIndex] ?? distractors[0];
    distractorIndex++;
    return { key, text };
  });
}

function buildQuestion(template: BranchTemplate, gradeLevel: number, unitTitle: string, unitIndex: number, sortOrder: number): CurriculumQuestion {
  const unitSlug = slugify(unitTitle);
  const correctChoice = CHOICE_KEYS[(sortOrder + unitIndex + gradeLevel) % CHOICE_KEYS.length];
  const outcomeCode = `${gradeLevel}.${template.branchSlug}.${unitIndex + 1}.${sortOrder}`;
  const profile = unitProfile(unitTitle);
  const outcomeTitle = `${unitTitle}: ${profile.skill}`;
  const bloomLevel = sortOrder <= 5 ? "understand" : sortOrder <= 14 ? "apply" : "analyze";
  return {
    id: `ctq-${gradeLevel}-${template.branchSlug}-${unitSlug}-${sortOrder}`,
    gradeLevel,
    branchSlug: template.branchSlug,
    branchName: template.branchName,
    unitSlug,
    unitTitle,
    outcomeCode,
    outcomeTitle,
    prompt: `${gradeLevel}. sınıf ${template.branchName} dersinde öğrenci ${profile.context}. ${sortOrder}. soruda hangi yaklaşım kazanımı en doğru şekilde gösterir?`,
    choices: buildChoices(correctChoice, gradeLevel, unitTitle, sortOrder),
    correctChoice,
    explanation: `Doğru cevap, ${profile.skill} becerisini ${profile.context} bağlamında kanıtla kullanan seçenektir. Yaygın hata: ${profile.misconception}.`,
    difficulty: sortOrder <= 6 ? "easy" : sortOrder <= 14 ? "medium" : "hard",
    sortOrder,
    metadata: {
      skill: profile.skill,
      misconception: profile.misconception,
      bloomLevel,
      estimatedSeconds: sortOrder <= 6 ? 45 : sortOrder <= 14 ? 70 : 95,
      practiceHint: `${unitTitle} için önce örnek çözümü incele, sonra benzer 8 hedefli soru çöz ve yanlışını not al.`,
    },
  };
}

export function enhanceCurriculumQuestion(question: CurriculumQuestion): CurriculumQuestion {
  const rebuilt = buildQuestion(
    {
      branchSlug: question.branchSlug,
      branchName: question.branchName,
      grades: [question.gradeLevel],
      units: [question.unitTitle],
    },
    question.gradeLevel,
    question.unitTitle,
    0,
    question.sortOrder,
  );
  return {
    ...rebuilt,
    id: question.id,
    correctChoice: question.correctChoice,
  };
}

export const STATIC_CURRICULUM_QUESTIONS: CurriculumQuestion[] = BRANCH_TEMPLATES.flatMap((template) =>
  template.grades.flatMap((gradeLevel) =>
    template.units.flatMap((unitTitle, unitIndex) =>
      Array.from({ length: 20 }, (_, index) => buildQuestion(template, gradeLevel, unitTitle, unitIndex, index + 1)),
    ),
  ),
);

export function publicCurriculumQuestion(question: CurriculumQuestion): PublicCurriculumQuestion {
  const { correctChoice: _correctChoice, explanation: _explanation, ...publicQuestion } = question;
  return publicQuestion;
}

export function getStaticCurriculumQuestions(args: {
  gradeLevel: number;
  branchSlug: string;
  unitSlug: string;
}): CurriculumQuestion[] {
  return STATIC_CURRICULUM_QUESTIONS.filter(
    (question) =>
      question.gradeLevel === args.gradeLevel &&
      question.branchSlug === args.branchSlug &&
      question.unitSlug === args.unitSlug,
  )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 20);
}

export function getStaticCurriculumCatalog(): CurriculumGrade[] {
  const byGrade = new Map<number, Map<string, CurriculumBranch>>();
  for (const question of STATIC_CURRICULUM_QUESTIONS) {
    if (!byGrade.has(question.gradeLevel)) byGrade.set(question.gradeLevel, new Map());
    const branches = byGrade.get(question.gradeLevel)!;
    if (!branches.has(question.branchSlug)) {
      branches.set(question.branchSlug, {
        branchSlug: question.branchSlug,
        branchName: question.branchName,
        units: [],
      });
    }
    const branch = branches.get(question.branchSlug)!;
    const unit = branch.units.find((item) => item.unitSlug === question.unitSlug);
    if (unit) unit.questionCount++;
    else branch.units.push({ unitSlug: question.unitSlug, unitTitle: question.unitTitle, questionCount: 1 });
  }
  return [...byGrade.entries()]
    .sort(([a], [b]) => a - b)
    .map(([gradeLevel, branches]) => ({
      gradeLevel,
      label: `${gradeLevel}. sınıf`,
      branches: [...branches.values()].sort((a, b) => a.branchName.localeCompare(b.branchName, "tr-TR")),
    }));
}

export function recommendationBranchSlugs(branchSlug: string): string[] {
  const genericMap: Record<string, string[]> = {
    "ilkokul-matematik": ["ilkokul-matematik", "matematik"],
    "ortaokul-matematik": ["ortaokul-matematik", "matematik", "lgs"],
    "ilkokul-turkce": ["ilkokul-turkce", "turkce"],
    "ortaokul-turkce": ["ortaokul-turkce", "turkce", "lgs"],
    "ilkokul-fen-bilimleri": ["ilkokul-fen-bilimleri", "ortaokul-fen-bilimleri", "fizik", "kimya", "biyoloji"],
    "ortaokul-fen-bilimleri": ["ortaokul-fen-bilimleri", "fizik", "kimya", "biyoloji", "lgs"],
    "ilkokul-sosyal-bilgiler": ["ilkokul-sosyal-bilgiler", "ortaokul-sosyal-bilgiler", "tarih", "cografya"],
    "ortaokul-sosyal-bilgiler": ["ortaokul-sosyal-bilgiler", "tarih", "cografya", "lgs"],
    "ilkokul-ingilizce": ["ilkokul-ingilizce", "ingilizce"],
    "ortaokul-ingilizce": ["ortaokul-ingilizce", "ingilizce", "lgs"],
    edebiyat: ["edebiyat", "turkce"],
  };
  return [...new Set(genericMap[branchSlug] ?? [branchSlug])];
}
