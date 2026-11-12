import { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import licenseText from '../../../LICENSE?raw';
import SliceOfFlowAuthorCredit from '@/components/SliceOfFlowAuthorCredit';
import SliceOfFlowRightsFooter, { PERMISSIONS_EMAIL } from '@/components/SliceOfFlowRightsFooter';
import '@/lib/sliceOfFlowLicense.css';

export default function SliceOfFlowLicense() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'License & Permissions | Slice of Flow';
    heading.current?.focus({ preventScroll: true });
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="sof-license-page">
      <header className="sof-license-header">
        <Link href="/" className="sof-license-back">← Back to Slice of Flow</Link>
        <SliceOfFlowAuthorCredit />
      </header>
      <main className="sof-license-main">
        <p className="sof-license-eyebrow">Slice of Flow · Ownership &amp; use</p>
        <h1 ref={heading} tabIndex={-1}>License &amp; Permissions</h1>
        <p className="sof-license-intro">Created and creatively directed by Jeff Bourke. Free to play does not mean free to resell, rehost or distribute.</p>
        <section className="sof-permissions-grid" aria-label="Permissions at a glance">
          <div className="sof-permission-card">
            <h2>Free hosted use</h2>
            <p>Personal learning and employee-led internal team workshops at one organization are permitted. You may share the provided results summaries and make reasonable debrief copies for participants in an authorized workshop.</p>
          </div>
          <div className="sof-permission-card">
            <h2>Ask Jeff first</h2>
            <p>Outside facilitation, paid or unpaid, resale, rehosting, white-labeling, source distribution and sublicensing require express written permission. Approval to facilitate does not also grant those other rights.</p>
            <a href={`mailto:${PERMISSIONS_EMAIL}`}>{PERMISSIONS_EMAIL}</a>
          </div>
        </section>
        <p className="sof-license-note">The full license below governs the covered material. Required third-party licenses and valid prior permissions remain intact. This page does not claim copyright over ideas, gameplay methods or otherwise unprotectable AI-generated output.</p>
        <section className="sof-license-full" aria-labelledby="full-license-title">
          <h2 id="full-license-title">Full proprietary license</h2>
          <div data-testid="full-license-text">
            {licenseText.trim().split(/\n\n+/).map((block, index) => /^\d+\./.test(block)
              ? <h3 key={index}>{block}</h3>
              : <p key={index}>{block}</p>)}
          </div>
        </section>
        <aside className="sof-license-contract-note">
          <h2>License notice—not a new visitor contract</h2>
          <p>The LICENSE grants the stated hosted-use permissions independently. Separate visitor Terms of Use remain a draft; this page does not claim that visitors have accepted that unpublished contract. This notice is not a copyright or trademark registration.</p>
        </aside>
        <Link href="/" className="sof-license-back">← Back to the kitchen</Link>
      </main>
      <SliceOfFlowRightsFooter />
    </div>
  );
}
