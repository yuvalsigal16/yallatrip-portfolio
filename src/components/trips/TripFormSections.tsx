'use client';

// The trip form's sections, shared by the new-trip wizard and trip settings.
import { ChoiceChip, ChoiceGroup } from '@/components/ChoiceChip';
import { TRANSPORTS, TRAVEL_STYLES } from '@/lib/auth/rules';
import { TravelersField } from '@/components/trips/TravelersField';

export type TripDefaults = {
  title?: string;
  destinationName?: string;
  placeId?: string;
  startDate?: string;
  endDate?: string;
  noDates?: boolean;
  travelers?: number;
  transport?: string[];
  styles?: string[];
  budget?: string | null;
  shabbat?: boolean;
  kosher?: boolean;
  legs?: { name: string; start: string | null; end: string | null }[];
};

/** The rows of the "where and when" list: the saved destinations, or the single main one. */
export function destinationRows(d: TripDefaults): { name: string; placeId?: string; start: string | null; end: string | null }[] {
  if (d.legs && d.legs.length > 0) {
    return d.legs.map((l, i) => ({ ...l, placeId: i === 0 ? d.placeId : undefined }));
  }
  return [{ name: d.destinationName ?? '', placeId: d.placeId, start: d.startDate || null, end: d.endDate || null }];
}

/** After a failed submit, the echoed values win over the original defaults. */
export function mergeEcho(defaults: TripDefaults, values?: Record<string, string>): TripDefaults {
  if (!values?.echoed) return defaults;
  const list = (v?: string) => (v ? v.split(',').filter(Boolean) : []);
  return {
    title: values.title ?? defaults.title,
    destinationName: values.destinationName ?? defaults.destinationName,
    placeId: values.placeId ?? defaults.placeId,
    startDate: values.startDate || defaults.startDate,
    endDate: values.endDate || defaults.endDate,
    noDates: values.noDates === 'on',
    travelers: Number(values.travelers) || defaults.travelers,
    transport: list(values.transport),
    styles: list(values.styles),
    budget: values.budget || null,
    shabbat: values.shabbat ? values.shabbat === 'yes' : defaults.shabbat,
    kosher: values.kosher ? values.kosher === 'yes' : defaults.kosher,
    legs: (() => {
      try {
        const l = JSON.parse(values.legs ?? '[]') as { name: string; start: string; end: string }[];
        return l.map((x) => ({ name: x.name, start: x.start || null, end: x.end || null }));
      } catch {
        return defaults.legs;
      }
    })(),
  };
}

export function WhoAndHowSection({ d, errors }: { d: TripDefaults; errors?: Partial<Record<string, string>> }) {
  return (
    <div className="flex flex-col gap-8">
      <TravelersField defaultValue={d.travelers ?? 2} error={errors?.travelers} />
      <ChoiceGroup title="איך זזים ביעד?" help="לחישוב זמני הגעה בין מקומות. אפשר לבחור כמה" error={errors?.transport}>
        {TRANSPORTS.map((t) => (
          <ChoiceChip key={t.key} type="checkbox" name="transport" value={t.key} label={t.label}
            defaultChecked={(d.transport ?? ['walk', 'transit']).includes(t.key)} />
        ))}
      </ChoiceGroup>
      <p className="rounded-xl bg-sand-2 px-4 py-3 text-[15px] text-ink-2">
        את המלון מוסיפים אחר כך, ישר מהמפה, כמו כל מקום אחר.
      </p>
    </div>
  );
}

/** Shabbat (this trip's own) and kosher (the traveller's, saved to the profile): in the new-trip form and trip settings. */
export function TripObservance({ shabbat = false, kosher = false }: { shabbat?: boolean; kosher?: boolean }) {
  return (
    <>
      <ChoiceGroup title="שומרים שבת בטיול הזה?" help="נציג מתי השבת נכנסת ויוצאת, כבר בזמן התכנון.">
        <ChoiceChip type="radio" name="shabbat" value="yes" label="כן" defaultChecked={shabbat} />
        <ChoiceChip type="radio" name="shabbat" value="no" label="לא" defaultChecked={!shabbat} />
      </ChoiceGroup>
      <ChoiceGroup title="שומרים כשרות?" help="בכרטיס של כל מקום יופיעו מסעדות כשרות ובית חב״ד בסביבה. נשמר גם בפרופיל.">
        <ChoiceChip type="radio" name="kosher" value="yes" label="כן" defaultChecked={kosher} />
        <ChoiceChip type="radio" name="kosher" value="no" label="לא" defaultChecked={!kosher} />
      </ChoiceGroup>
    </>
  );
}

export function StyleSection({ d, errors }: { d: TripDefaults; errors?: Partial<Record<string, string>> }) {
  return (
    <div className="flex flex-col gap-8">
      <ChoiceGroup title="מה בא לכם בטיול הזה?" help="אפשר לבחור כמה" error={errors?.styles}>
        {TRAVEL_STYLES.map((s) => (
          <ChoiceChip key={s.key} type="checkbox" name="styles" value={s.key} label={s.label}
            defaultChecked={(d.styles ?? []).includes(s.key)} />
        ))}
      </ChoiceGroup>
      <TripObservance shabbat={d.shabbat} kosher={d.kosher} />
    </div>
  );
}
