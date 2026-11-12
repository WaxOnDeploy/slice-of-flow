import { AUTHOR_NAME } from '@/lib/sliceOfFlowBrand';
import '@/lib/sliceOfFlowLicense.css';

export const COPYRIGHT_NOTICE = `© 2026 ${AUTHOR_NAME}`;
export const PERMISSIONS_EMAIL = 'jeff@thefatalfive.com';

export default function SliceOfFlowRightsFooter() {
  return (
    <footer className="sof-rights-footer" data-testid="sof-rights-footer" aria-label="Slice of Flow copyright and permissions">
      <span>{COPYRIGHT_NOTICE}. All rights reserved in protectable material he authored or lawfully owns.</span>
      <nav aria-label="Copyright and permissions links">
        <a href={`${import.meta.env.BASE_URL}license`} target="_blank" rel="noopener noreferrer" aria-label="License & Permissions (opens in a new tab)">
          License &amp; Permissions
        </a>
        <a href={`mailto:${PERMISSIONS_EMAIL}`}>{PERMISSIONS_EMAIL}</a>
      </nav>
    </footer>
  );
}
