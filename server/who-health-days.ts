export interface WHOHealthDay {
  title: string;
  month: number;
  day: number;
  endMonth?: number;
  endDay?: number;
  organiser: string;
  tags: string[];
}

export const WHO_HEALTH_DAYS: WHOHealthDay[] = [
  { title: "World Leprosy Day", month: 1, day: 25, organiser: "WHO", tags: ["NTDs", "leprosy"] },
  { title: "World Neglected Tropical Diseases Day", month: 1, day: 30, organiser: "WHO", tags: ["NTDs", "research"] },

  { title: "World Cancer Day", month: 2, day: 4, organiser: "UICC / WHO", tags: ["cancer", "NCD"] },
  { title: "International Day of Zero Tolerance for Female Genital Mutilation", month: 2, day: 6, organiser: "UN / WHO", tags: ["gender-health", "policy"] },
  { title: "Rare Disease Day", month: 2, day: 28, organiser: "EURORDIS / WHO", tags: ["rare-disease", "research"] },

  { title: "Zero Discrimination Day", month: 3, day: 1, organiser: "UNAIDS / WHO", tags: ["HIV/AIDS", "equity"] },
  { title: "World Hearing Day", month: 3, day: 3, organiser: "WHO", tags: ["hearing", "disability"] },
  { title: "World Obesity Day", month: 3, day: 4, organiser: "World Obesity Federation / WHO", tags: ["NCD", "obesity"] },
  { title: "International Women's Day — Health Focus", month: 3, day: 8, organiser: "UN / WHO", tags: ["gender-health", "equity"] },
  { title: "World Tuberculosis Day", month: 3, day: 24, organiser: "WHO", tags: ["TB", "infectious-disease"] },

  { title: "World Health Day", month: 4, day: 7, organiser: "WHO", tags: ["policy", "health-systems"] },
  { title: "World Chagas Disease Day", month: 4, day: 14, organiser: "WHO", tags: ["NTDs", "Chagas"] },
  { title: "World Immunization Week", month: 4, day: 24, endMonth: 4, endDay: 30, organiser: "WHO", tags: ["immunization", "vaccines"] },
  { title: "World Malaria Day", month: 4, day: 25, organiser: "WHO", tags: ["malaria", "infectious-disease"] },

  { title: "World Hand Hygiene Day", month: 5, day: 5, organiser: "WHO", tags: ["infection-prevention", "patient-safety"] },
  { title: "World Asthma Day", month: 5, day: 5, organiser: "GINA / WHO", tags: ["NCD", "respiratory"] },
  { title: "World Ovarian Cancer Day", month: 5, day: 8, organiser: "WHO", tags: ["cancer", "gender-health"] },
  { title: "International Day of the Nurse", month: 5, day: 12, organiser: "ICN / WHO", tags: ["health-workforce", "nursing"] },
  { title: "WHO World Health Assembly", month: 5, day: 18, endMonth: 5, endDay: 28, organiser: "WHO", tags: ["policy", "governance"] },
  { title: "World No Tobacco Day", month: 5, day: 31, organiser: "WHO", tags: ["NCD", "tobacco"] },

  { title: "World Food Safety Day", month: 6, day: 7, organiser: "WHO / FAO", tags: ["food-safety", "nutrition"] },
  { title: "World Blood Donor Day", month: 6, day: 14, organiser: "WHO", tags: ["blood-safety", "donation"] },

  { title: "World Drowning Prevention Day", month: 7, day: 25, organiser: "WHO / UN", tags: ["injury-prevention", "drowning"] },
  { title: "World Hepatitis Day", month: 7, day: 28, organiser: "WHO", tags: ["hepatitis", "infectious-disease"] },

  { title: "World Breastfeeding Week", month: 8, day: 1, endMonth: 8, endDay: 7, organiser: "WHO / UNICEF", tags: ["maternal-health", "nutrition", "child-health"] },

  { title: "World Suicide Prevention Day", month: 9, day: 10, organiser: "IASP / WHO", tags: ["mental-health", "suicide-prevention"] },
  { title: "World Patient Safety Day", month: 9, day: 17, organiser: "WHO", tags: ["patient-safety", "health-systems"] },
  { title: "World Alzheimer's Day", month: 9, day: 21, organiser: "ADI / WHO", tags: ["NCD", "mental-health", "dementia"] },
  { title: "World Rabies Day", month: 9, day: 28, organiser: "GARC / WHO", tags: ["NTDs", "zoonosis", "rabies"] },
  { title: "World Heart Day", month: 9, day: 29, organiser: "WHF / WHO", tags: ["NCD", "cardiovascular"] },

  { title: "World Sight Day", month: 10, day: 8, organiser: "IAPB / WHO", tags: ["vision", "disability"] },
  { title: "World Mental Health Day", month: 10, day: 10, organiser: "WHO", tags: ["mental-health", "NCD"] },
  { title: "World Polio Day", month: 10, day: 24, organiser: "WHO / Rotary", tags: ["polio", "immunization"] },
  { title: "International Lead Poisoning Prevention Week", month: 10, day: 25, endMonth: 10, endDay: 31, organiser: "WHO", tags: ["environment-health", "poisoning"] },

  { title: "World Diabetes Day", month: 11, day: 14, organiser: "IDF / WHO", tags: ["NCD", "diabetes"] },
  { title: "World Cervical Cancer Elimination Day", month: 11, day: 17, organiser: "WHO", tags: ["cancer", "gender-health", "HPV"] },
  { title: "World Prematurity Day", month: 11, day: 17, organiser: "WHO / EFCNI", tags: ["maternal-health", "child-health", "neonatal"] },
  { title: "World Antimicrobial Resistance Awareness Week", month: 11, day: 18, endMonth: 11, endDay: 24, organiser: "WHO", tags: ["AMR", "infectious-disease"] },
  { title: "World COPD Day", month: 11, day: 18, organiser: "GOLD / WHO", tags: ["NCD", "respiratory"] },
  { title: "International Day for the Elimination of Violence Against Women", month: 11, day: 25, organiser: "UN / WHO", tags: ["gender-health", "violence-prevention"] },

  { title: "World AIDS Day", month: 12, day: 1, organiser: "UNAIDS / WHO", tags: ["HIV/AIDS", "infectious-disease"] },
  { title: "International Day of Persons with Disabilities", month: 12, day: 3, organiser: "UN / WHO", tags: ["disability", "equity"] },
  { title: "Universal Health Coverage Day", month: 12, day: 12, organiser: "WHO / UN", tags: ["UHC", "policy", "health-systems"] },
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function generateEventsForYear(year: number) {
  return WHO_HEALTH_DAYS.map(day => {
    const startDate = `${year}-${pad(day.month)}-${pad(day.day)}`;
    const endDate = day.endMonth && day.endDay
      ? `${year}-${pad(day.endMonth)}-${pad(day.endDay)}`
      : null;
    return {
      title: day.title,
      startDate,
      endDate,
      organiser: day.organiser,
      regionScope: "Global",
      tags: day.tags,
      sourceNote: "WHO Global Health Days",
    };
  });
}
