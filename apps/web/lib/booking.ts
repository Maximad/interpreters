export type Quote = {
  id: string;
  amount_aed: string;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  interpreter_profile?: { user: { full_name: string } };
};

export type BookingRequest = {
  id: string;
  source_language: string;
  target_language: string;
  domain: string;
  city: string;
  onsite_required: boolean;
  scheduled_for: string;
  notes: string | null;
  status: 'OPEN' | 'FILLED' | 'CLOSED';
  quotes: Quote[];
};

export function formatRequestTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(value));
}
