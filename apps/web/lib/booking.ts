export type Quote = {
  id: string;
  amount_aed: string;
  message: string | null;
  duration_minutes: number | null;
  payment_terms: string | null;
  cancellation_terms: string | null;
  revision: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  interpreter_profile?: { user: { full_name: string } };
};

export type BookingSession = {
  details: string | null;
  completed_at: string | null;
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
  session: BookingSession | null;
};

export function formatRequestTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(value));
}
