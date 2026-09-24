'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { apiFetch, useErrorMessage } from '@/lib/api-client';
import { FEEDBACK_COMMENT_MAX, RATINGS } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Note en étoiles, en lecture seule. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-hidden>
      {RATINGS.map((n) => (
        <Star key={n} className={cn('h-4 w-4', n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
      ))}
    </span>
  );
}

// Avis après passage : note obligatoire (1 à 5), commentaire facultatif, un seul envoi.
export function FeedbackForm({ publicCode, feedback }: { publicCode: string; feedback: { open: boolean; rating: number | null } }) {
  const t = useTranslations('ticket');
  const errorMessage = useErrorMessage();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  const given = sent ?? feedback.rating;
  if (given !== null) {
    return (
      <div className="mt-2 flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-4 text-sm">
        <span className="sr-only">{t('feedbackStars', { count: given })}</span>
        <Stars value={given} className="[&_svg]:h-6 [&_svg]:w-6" />
        <p className="font-medium">{t('feedbackThanks')}</p>
      </div>
    );
  }
  if (!feedback.open) return null;

  async function submit() {
    if (!rating) return;
    setSending(true);
    const res = await apiFetch('/api/tickets/feedback', { method: 'POST', json: { publicCode, rating, comment } });
    setSending(false);
    if (res.ok) setSent(rating);
    // Déjà noté (autre onglet) : on affiche simplement le remerciement.
    else if (res.error === 'feedback_exists') setSent(rating);
    else toast.error(errorMessage(res));
  }

  const shown = hover || rating;
  return (
    <div className="mt-2 space-y-3 rounded-xl border bg-background p-4 text-center">
      <p className="font-semibold">{t('feedbackTitle')}</p>
      <div role="radiogroup" aria-label={t('feedbackTitle')} className="flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t('feedbackStars', { count: n })}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={cn('h-9 w-9', n <= shown ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={FEEDBACK_COMMENT_MAX}
            placeholder={t('feedbackCommentPlaceholder')}
            aria-label={t('feedbackCommentPlaceholder')}
            rows={3}
          />
          <Button onClick={submit} disabled={sending} className="w-full">
            {sending ? t('feedbackSending') : t('feedbackSend')}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t('feedbackPrivacy')}</p>
    </div>
  );
}
