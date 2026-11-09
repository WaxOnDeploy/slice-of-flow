import { AUTHOR_CREDENTIALS, AUTHOR_LINKEDIN_URL, AUTHOR_NAME } from '@/lib/sliceOfFlowBrand';

export default function SliceOfFlowAuthorCredit({ className = '' }: { className?: string }) {
  return (
    <p
      data-testid="author-credit"
      className={`text-sm sm:text-base leading-relaxed font-semibold ${className}`}
      style={{ fontFamily: "'DM Sans', sans-serif", color: '#534334' }}
    >
      Built by{' '}
      <a
        href={AUTHOR_LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 rounded-sm hover:text-[#A43A2A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1976D2]"
      >
        {AUTHOR_NAME}
      </a>
      {`, ${AUTHOR_CREDENTIALS}`}
    </p>
  );
}
