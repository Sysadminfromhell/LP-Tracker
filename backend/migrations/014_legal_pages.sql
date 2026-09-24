CREATE TABLE legal_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legal_pages_slug_check CHECK (slug IN ('privacy', 'privacy-data', 'privacy-rights', 'imprint'))
);

INSERT INTO legal_pages (slug, title, content_html, published) VALUES
('privacy', 'Privacy Policy', '<h1>Privacy Policy</h1><p>Please complete the privacy policy for this installation.</p>', FALSE),
('privacy-data', 'Processed Data', '<h1>Processed Data</h1><p>Describe the data processing and retention rules for this installation.</p>', FALSE),
('privacy-rights', 'Your Rights', '<h1>Your Rights</h1><p>Add the contact details and procedure for data subject requests.</p>', FALSE),
('imprint', 'Imprint', '<h1>Imprint</h1><p>Add the operator details for this installation.</p>', FALSE)
ON CONFLICT (slug) DO NOTHING;
