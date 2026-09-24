CREATE TABLE legal_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legal_pages_slug_check CHECK (slug IN ('privacy', 'privacy-data', 'privacy-rights', 'imprint'))
);

INSERT INTO legal_pages (slug, title, content_html, published) VALUES
(
  'privacy',
  'Privacy Policy',
  $$<h1>Privacy Policy</h1>
<p>This Privacy Policy explains how personal data may be processed when using this LP-Tracker installation and when participating in League of Legends LP events tracked through the platform.</p>

<h2>1. Controller</h2>
<p>The controller responsible for this LP-Tracker installation is:</p>
<p><strong>[OPERATOR NAME]</strong><br>[STREET / HOUSE NUMBER]<br>[POSTCODE / CITY]<br>[COUNTRY]</p>
<p>Email: <strong>[PRIVACY CONTACT EMAIL]</strong></p>

<h2>2. Purpose of Processing</h2>
<p>LP-Tracker processes data for the operation of League of Legends LP events and related application functionality.</p>
<ul>
<li>managing players and event participation;</li>
<li>displaying event leaderboards and historical standings;</li>
<li>calculating LP progression during events;</li>
<li>displaying rank, match and performance information;</li>
<li>retrieving League of Legends data from the configured provider;</li>
<li>maintaining player profiles and event history;</li>
<li>administering, securing and troubleshooting the application.</li>
</ul>
<p>LP-Tracker itself does not provide advertising or behavioural advertising functionality.</p>

<h2>3. Sources of Player Data</h2>
<p>Player information may be entered by an administrator or retrieved from an external League of Legends data provider.</p>
<p>Depending on the configuration of this installation, data may be retrieved through the Riot Games API or through the OP.GG provider supported by LP-Tracker.</p>
<p>Where information is obtained from an external provider rather than directly from the player, the data may include Riot ID information, region, rank, League Points, profile information and ranked match information.</p>

<h2>4. Publicly Visible Information</h2>
<p>LP-Tracker is designed to display public event leaderboards and event history. Depending on the application configuration, the following information may be publicly visible:</p>
<ul>
<li>Riot game name and tag line;</li>
<li>region;</li>
<li>profile image;</li>
<li>rank and League Points;</li>
<li>LP progression and event placement;</li>
<li>wins and losses;</li>
<li>ranked match history and results;</li>
<li>champion, position and match performance information;</li>
<li>event participation and historical event results;</li>
<li>optional Twitch and X usernames where configured.</li>
</ul>

<h2>5. League Data Providers</h2>
<p>LP-Tracker retrieves League of Legends information from the data provider configured by the installation operator.</p>
<p>For this purpose, player identifiers such as Riot game name, tag line and region may be transmitted to the configured provider in order to retrieve profile, ranking and match information.</p>
<p>The external provider processes requests according to its own infrastructure and privacy terms.</p>

<h2>6. External Game Assets</h2>
<p>LP-Tracker may load League of Legends assets such as champion icons, item icons and profile images from Riot Games Data Dragon or from URLs supplied by the configured provider.</p>
<p>When resources are loaded directly by a browser, technical connection information such as the visitor's IP address may be transmitted to the server providing the resource.</p>

<h2>7. Administrator Authentication</h2>
<p>The public LP-Tracker pages do not require an account.</p>
<p>The administration interface uses the technically necessary session cookie <strong>lp_tracker_admin_session</strong> to authenticate administrators.</p>
<p>The cookie is configured as HttpOnly and SameSite=Strict. In production environments it is additionally marked Secure. Administrator sessions expire automatically.</p>
<p>LP-Tracker itself does not include advertising or analytics cookies.</p>

<h2>8. Storage and Retention</h2>
<p>Persistent LP-Tracker application data is stored in the PostgreSQL database configured by the installation operator.</p>
<p>Player records may remain stored across multiple events in order to maintain player profiles and historical event results.</p>
<p>Detailed match and match-participant information for completed events can be removed through the application's database retention tools. Administrators may also remove players, completed events and cached data through the administration interface.</p>
<p>The installation operator must define appropriate retention periods for the actual deployment.</p>

<h2>9. Administrator Data</h2>
<p>For administrators, LP-Tracker may process:</p>
<ul>
<li>administrator username;</li>
<li>password hash;</li>
<li>account creation and update timestamps;</li>
<li>last login timestamp;</li>
<li>authentication session information and session timestamps.</li>
</ul>
<p>Administrator passwords are not stored in plain text.</p>

<h2>10. Hosting and Technical Logs</h2>
<p><strong>[DESCRIBE HOSTING PROVIDER / SELF-HOSTING SETUP]</strong></p>
<p>The hosting, reverse-proxy or infrastructure components used for this installation may process technical connection information such as IP addresses, timestamps, requested resources, HTTP status information and user-agent information where logging is enabled.</p>
<p><strong>[DESCRIBE ACTUAL LOGGING AND RETENTION CONFIGURATION]</strong></p>

<h2>11. Legal Basis</h2>
<p><strong>[REVIEW AND INSERT THE APPLICABLE LEGAL BASIS FOR THIS INSTALLATION]</strong></p>
<p>The installation operator is responsible for identifying the applicable legal basis for each processing activity. Where processing relies on legitimate interests, those interests should also be described here.</p>

<h2>12. Recipients</h2>
<p>Depending on the deployment, data may be processed by:</p>
<ul>
<li>the installation operator and authorised administrators;</li>
<li>the configured League of Legends data provider;</li>
<li>hosting or infrastructure providers used by the operator;</li>
<li>other recipients where required by applicable law.</li>
</ul>
<p>Information intentionally published through leaderboard, player and event pages is accessible to visitors of this LP-Tracker installation.</p>

<h2>13. International Data Transfers</h2>
<p>Whether personal data is transferred outside the European Economic Area depends on the configured provider, hosting infrastructure and external resources used by this installation.</p>
<p>The installation operator is responsible for reviewing any applicable international data-transfer requirements.</p>

<h2>14. Your Rights</h2>
<p>Depending on the circumstances and applicable law, data subjects may have rights including access, rectification, erasure, restriction of processing, data portability and objection.</p>
<p>Further information is available on the Your Rights page.</p>

<h2>15. Changes to this Privacy Policy</h2>
<p>This Privacy Policy may be updated when the functionality, infrastructure or processing activities of the LP-Tracker installation change.</p>
<p>The operator should review this template before publication and whenever the deployment changes.</p>$$,
  FALSE
),
(
  'privacy-data',
  'Processed Data',
  $$<h1>Processed Data</h1>
<p>This page provides an overview of the categories of information that LP-Tracker may store or process.</p>

<h2>Player Identity</h2>
<ul>
<li>Riot game name;</li>
<li>Riot tag line;</li>
<li>League region;</li>
<li>internal LP-Tracker player identifier;</li>
<li>optional Twitch username;</li>
<li>optional X username;</li>
<li>player enabled or disabled state;</li>
<li>creation and update timestamps.</li>
</ul>

<h2>Player Profile and Rank Cache</h2>
<p>LP-Tracker maintains a local cache of successfully retrieved player information so that the application can continue displaying the most recently known player state.</p>
<ul>
<li>profile image URL;</li>
<li>rank tier and division;</li>
<li>League Points;</li>
<li>internal rank score used by LP-Tracker;</li>
<li>season wins and losses;</li>
<li>last successful provider refresh;</li>
<li>last refresh attempt;</li>
<li>last provider error where applicable;</li>
<li>cache update timestamp.</li>
</ul>

<h2>Event Participation</h2>
<p>When a player participates in an event, LP-Tracker stores event-specific snapshots used to calculate progression and final standings.</p>
<ul>
<li>event and player identifiers;</li>
<li>starting rank, division and LP;</li>
<li>starting wins and losses;</li>
<li>starting rank score;</li>
<li>latest resolved rank score;</li>
<li>final rank, LP, wins and losses for ended events;</li>
<li>snapshot timestamps.</li>
</ul>

<h2>Ranked Match Data</h2>
<p>For ranked matches associated with an event, LP-Tracker may store:</p>
<ul>
<li>provider match identifier;</li>
<li>match creation time and duration;</li>
<li>champion identifier and champion name;</li>
<li>position or role;</li>
<li>kills, deaths and assists;</li>
<li>creep score;</li>
<li>match result;</li>
<li>calculated LP change;</li>
<li>rank score following the match where available;</li>
<li>LP-resolution status;</li>
<li>discovery and update timestamps.</li>
</ul>

<h2>Detailed Match Information</h2>
<p>Where available, LP-Tracker may additionally store detailed match information for participants in a tracked match.</p>
<ul>
<li>ally or enemy side;</li>
<li>position;</li>
<li>champion;</li>
<li>kills, deaths and assists;</li>
<li>lane and jungle creep score;</li>
<li>damage dealt to champions;</li>
<li>item identifiers;</li>
<li>whether the participant represents the tracked player.</li>
</ul>
<p>Detailed match information for completed events can be removed using LP-Tracker's retention tools without deleting the event or its basic match history.</p>

<h2>LP Observations and Reconciliation</h2>
<p>LP-Tracker may store rank-score observations used to reconcile LP changes between individual matches.</p>
<ul>
<li>event participant identifier;</li>
<li>observed rank score;</li>
<li>observation timestamp;</li>
<li>observation source;</li>
<li>reconciliation retry state and technical error information where applicable.</li>
</ul>

<h2>Event Information</h2>
<p>LP-Tracker stores information required to operate and retain event history, including:</p>
<ul>
<li>event name;</li>
<li>event start and end times;</li>
<li>event status;</li>
<li>selected and participating players;</li>
<li>final event standings;</li>
<li>creation and update timestamps.</li>
</ul>

<h2>Administrator Information</h2>
<p>The administration system may store:</p>
<ul>
<li>administrator username;</li>
<li>password hash;</li>
<li>enabled state;</li>
<li>last login timestamp;</li>
<li>account timestamps;</li>
<li>session token hash;</li>
<li>session creation, expiry and last-use timestamps.</li>
</ul>

<h2>Legal Page Content</h2>
<p>The text and publication status of the Privacy Policy, Processed Data, Your Rights and Imprint pages are stored in the LP-Tracker database.</p>

<h2>Data Sources</h2>
<p>Data may originate from:</p>
<ul>
<li>information entered by an LP-Tracker administrator;</li>
<li>the Riot Games API;</li>
<li>the OP.GG provider supported by LP-Tracker;</li>
<li>data generated internally by LP-Tracker while operating events.</li>
</ul>

<h2>Public Visibility</h2>
<p>Player, leaderboard, event-history and match information is intended to be displayed publicly where the corresponding frontend pages expose that information.</p>
<p>Administrator credentials, password hashes, session hashes, internal error state and database maintenance data are not intended for public display.</p>

<h2>Retention</h2>
<p>LP-Tracker does not impose one universal retention period for every deployment.</p>
<p>The operator is responsible for defining suitable retention periods. LP-Tracker provides administrative tools for removing player cache data, detailed historical match information, players and ended events.</p>$$,
  FALSE
),
(
  'privacy-rights',
  'Your Rights',
  $$<h1>Your Rights</h1>
<p>Depending on the circumstances and the applicable data-protection law, you may have rights concerning personal data processed through this LP-Tracker installation.</p>

<h2>Right of Access</h2>
<p>You may have the right to request information about whether personal data concerning you is being processed and to receive access to that data and related processing information.</p>

<h2>Right to Rectification</h2>
<p>You may have the right to request correction of inaccurate personal data and completion of incomplete personal data.</p>

<h2>Right to Erasure</h2>
<p>Under the conditions provided by applicable law, you may have the right to request deletion of personal data concerning you.</p>
<p>The right to erasure is not absolute and may be limited where continued processing is permitted or required by law.</p>

<h2>Right to Restriction of Processing</h2>
<p>Under certain conditions, you may have the right to request that processing of your personal data is restricted.</p>

<h2>Right to Data Portability</h2>
<p>Where the legal requirements are met, you may have the right to receive personal data you provided in a structured, commonly used and machine-readable format and to transmit that data to another controller.</p>

<h2>Right to Object</h2>
<p>Where processing is based on a legal basis that provides a right to object, you may object to the processing on grounds relating to your particular situation.</p>

<h2>Right to Withdraw Consent</h2>
<p>Where processing is based on consent, you may withdraw that consent at any time. Withdrawal does not affect the lawfulness of processing carried out before the withdrawal.</p>

<h2>Right to Lodge a Complaint</h2>
<p>You may have the right to lodge a complaint with a competent data-protection supervisory authority.</p>

<h2>How to Make a Request</h2>
<p>Requests concerning personal data processed by this LP-Tracker installation should be sent to:</p>
<p><strong>[PRIVACY CONTACT EMAIL]</strong></p>
<p>Please provide enough information to identify the relevant LP-Tracker player account, for example the Riot game name, tag line and region.</p>
<p>The operator may request additional information where reasonably necessary to verify the identity of the person making the request.</p>

<h2>Requests Concerning Provider Data</h2>
<p>Some information displayed by LP-Tracker originates from an external League data provider. A request to the LP-Tracker operator affects data controlled by this installation but does not automatically remove or modify information held independently by Riot Games, OP.GG or another external provider.</p>

<h2>Operator Review Required</h2>
<p>This page is a template supplied with LP-Tracker. The installation operator must review the available rights, contact information and request procedure before publishing it.</p>$$,
  FALSE
),
(
  'imprint',
  'Imprint',
  $$<h1>Imprint</h1>
<p>This page contains the operator information for this LP-Tracker installation.</p>
<p>LP-Tracker is an independent project and is not endorsed by Riot Games, OP.GG or their affiliates.</p>

<h2>Operator</h2>
<p><strong>[FULL LEGAL NAME / COMPANY NAME]</strong><br>[STREET / HOUSE NUMBER]<br>[POSTCODE / CITY]<br>[COUNTRY]</p>

<h2>Contact</h2>
<p>Email: <strong>[CONTACT EMAIL]</strong></p>
<p><strong>[OPTIONAL ADDITIONAL CONTACT INFORMATION]</strong></p>

<h2>Represented By</h2>
<p><strong>[NAME OF REPRESENTATIVE, IF APPLICABLE]</strong></p>

<h2>Register Information</h2>
<p><strong>[REGISTER AND REGISTRATION NUMBER, IF APPLICABLE]</strong></p>

<h2>VAT / Business Identification</h2>
<p><strong>[VAT ID OR BUSINESS IDENTIFICATION NUMBER, IF APPLICABLE]</strong></p>

<h2>Supervisory Authority</h2>
<p><strong>[SUPERVISORY AUTHORITY, IF APPLICABLE]</strong></p>

<h2>Responsibility for Content</h2>
<p><strong>[ADD ANY ADDITIONAL INFORMATION REQUIRED FOR THIS INSTALLATION OR OPERATOR]</strong></p>

<h2>Project Information</h2>
<p>This website operates an installation of the open-source LP-Tracker project.</p>
<p>LP-Tracker is an independent project and is not endorsed by Riot Games, OP.GG or their affiliates.</p>

<h2>Before Publishing</h2>
<p>This imprint is provided as a technical template only. The operator must replace all placeholders and verify which statutory information requirements apply to the actual deployment before publishing this page.</p>$$,
  FALSE
)
ON CONFLICT (slug) DO NOTHING;
