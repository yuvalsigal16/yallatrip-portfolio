import { ChoiceChip as Choice, ChoiceGroup as Question } from '@/components/ChoiceChip';

/** "שומרים שבת?" and "שומרים כשרות?": yes/no, each with a line on what it changes. In the opening questions and the profile. */
export function ObservanceQuestions({ shabbat = false, kosher = false }: { shabbat?: boolean; kosher?: boolean }) {
  return (
    <>
      <Question title="שומרים שבת?" help="כל טיול חדש יתחיל עם שבת מסומנת, ונציג מתי השבת נכנסת ויוצאת, כבר בזמן התכנון.">
        <Choice type="radio" name="shabbat" value="yes" label="כן" defaultChecked={shabbat} />
        <Choice type="radio" name="shabbat" value="no" label="לא" defaultChecked={!shabbat} />
      </Question>
      <Question title="שומרים כשרות?" help="בכרטיס של כל מקום יופיעו מסעדות כשרות ובית חב״ד בסביבה, תחת '🇮🇱 ישראלי'.">
        <Choice type="radio" name="kosher" value="yes" label="כן" defaultChecked={kosher} />
        <Choice type="radio" name="kosher" value="no" label="לא" defaultChecked={!kosher} />
      </Question>
    </>
  );
}
