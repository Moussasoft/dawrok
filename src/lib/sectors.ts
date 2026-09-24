// Secteurs d'activité et modèles de démarrage (agence + prestations) par langue.

export const SECTORS = ['hairdresser', 'doctor', 'vehicle_inspection', 'bank', 'restaurant', 'other'] as const;
export type Sector = (typeof SECTORS)[number];

/** Clé de traduction (`sectors.<clé>`) — les clés i18n sont en camelCase. */
export const SECTOR_I18N_KEY: Record<Sector, string> = {
  hairdresser: 'hairdresser',
  doctor: 'doctor',
  vehicle_inspection: 'vehicleInspection',
  bank: 'bank',
  restaurant: 'restaurant',
  other: 'other',
};

export function isSector(value: string): value is Sector {
  return (SECTORS as readonly string[]).includes(value);
}

type Preset = { branchName: string; services: { name: string; durationMin: number }[] };

const PRESETS: Record<'fr' | 'en' | 'ar', Record<Sector, Preset>> = {
  fr: {
    hairdresser: { branchName: 'Salon principal', services: [{ name: 'Coupe homme', durationMin: 25 }, { name: 'Coupe + barbe', durationMin: 40 }, { name: 'Coloration', durationMin: 60 }] },
    doctor: { branchName: 'Cabinet', services: [{ name: 'Consultation', durationMin: 20 }, { name: 'Renouvellement', durationMin: 10 }] },
    vehicle_inspection: { branchName: 'Centre de visite', services: [{ name: 'Auto', durationMin: 25 }, { name: 'Moto', durationMin: 15 }, { name: 'Poids lourd', durationMin: 45 }] },
    bank: { branchName: 'Agence', services: [{ name: 'Caisse', durationMin: 8 }, { name: 'Conseiller', durationMin: 25 }] },
    restaurant: { branchName: 'Restaurant', services: [{ name: 'Table', durationMin: 60 }] },
    other: { branchName: 'Point de service', services: [{ name: 'Service standard', durationMin: 20 }] },
  },
  en: {
    hairdresser: { branchName: 'Main salon', services: [{ name: "Men's haircut", durationMin: 25 }, { name: 'Haircut + beard', durationMin: 40 }, { name: 'Colouring', durationMin: 60 }] },
    doctor: { branchName: 'Practice', services: [{ name: 'Consultation', durationMin: 20 }, { name: 'Prescription renewal', durationMin: 10 }] },
    vehicle_inspection: { branchName: 'Inspection centre', services: [{ name: 'Car', durationMin: 25 }, { name: 'Motorbike', durationMin: 15 }, { name: 'Heavy vehicle', durationMin: 45 }] },
    bank: { branchName: 'Branch', services: [{ name: 'Cashier', durationMin: 8 }, { name: 'Advisor', durationMin: 25 }] },
    restaurant: { branchName: 'Restaurant', services: [{ name: 'Table', durationMin: 60 }] },
    other: { branchName: 'Service point', services: [{ name: 'Standard service', durationMin: 20 }] },
  },
  ar: {
    hairdresser: { branchName: 'الصالون الرئيسي', services: [{ name: 'حلاقة رجالية', durationMin: 25 }, { name: 'حلاقة + لحية', durationMin: 40 }, { name: 'صباغة', durationMin: 60 }] },
    doctor: { branchName: 'العيادة', services: [{ name: 'استشارة', durationMin: 20 }, { name: 'تجديد وصفة', durationMin: 10 }] },
    vehicle_inspection: { branchName: 'مركز الفحص التقني', services: [{ name: 'سيارة', durationMin: 25 }, { name: 'دراجة نارية', durationMin: 15 }, { name: 'مركبة ثقيلة', durationMin: 45 }] },
    bank: { branchName: 'الوكالة', services: [{ name: 'الشباك', durationMin: 8 }, { name: 'مستشار', durationMin: 25 }] },
    restaurant: { branchName: 'المطعم', services: [{ name: 'طاولة', durationMin: 60 }] },
    other: { branchName: 'نقطة الخدمة', services: [{ name: 'خدمة عادية', durationMin: 20 }] },
  },
};

export function getSectorPreset(sector: string, locale: string): Preset {
  const lang = locale === 'fr' || locale === 'en' || locale === 'ar' ? locale : 'fr';
  return PRESETS[lang][isSector(sector) ? sector : 'other'];
}
