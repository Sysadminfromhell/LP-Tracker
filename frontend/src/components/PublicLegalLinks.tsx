import { Link } from 'react-router';

function PublicLegalLinks() {
  return (
    <nav className="public-legal-links" aria-label="Legal information">
      <Link to="/privacy">Privacy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacy/data">Processed Data</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacy/rights">Your Rights</Link>
      <span aria-hidden="true">·</span>
      <Link to="/imprint">Imprint</Link>
    </nav>
  );
}
export default PublicLegalLinks;
