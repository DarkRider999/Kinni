/// Domain enumerations shared by entities, services and UI.
///
/// Each enum stores its [name] in persistence; `fromName` helpers fall back to
/// a safe default so a corrupted or newer value never crashes decoding.
library;

T _byName<T extends Enum>(List<T> values, Object? name, T fallback) {
  for (final v in values) {
    if (v.name == name) return v;
  }
  return fallback;
}

/// Application / lead lifecycle (11 states, see docs/03-database-design.md §4).
enum LeadStatus {
  newLead('New Lead'),
  interested('Interested'),
  documentsRequested('Documents Requested'),
  documentsReceived('Documents Received'),
  applicationSubmitted('Application Submitted'),
  underReview('Under Review'),
  approved('Approved'),
  disbursed('Disbursed'),
  rejected('Rejected'),
  notEligible('Not Eligible'),
  notInterested('Not Interested');

  const LeadStatus(this.label);
  final String label;

  static LeadStatus fromName(Object? n) => _byName(values, n, LeadStatus.newLead);

  /// The happy-path pipeline in order (used by the funnel and stepper).
  static const pipeline = [
    newLead,
    interested,
    documentsRequested,
    documentsReceived,
    applicationSubmitted,
    underReview,
    approved,
    disbursed,
  ];

  bool get isConverted => this == approved || this == disbursed;
  bool get isClosedLost => this == rejected || this == notEligible || this == notInterested;
  bool get isOpen => !isConverted && !isClosedLost;
  bool get isDecided => isConverted || this == rejected || this == notEligible;
  bool get isDocumentStage => this == documentsRequested || this == documentsReceived;

  /// Position in [pipeline]; closed-lost states return -1.
  int get pipelineIndex => pipeline.indexOf(this);
}

enum Priority {
  low('Low'),
  medium('Medium'),
  high('High'),
  urgent('Urgent');

  const Priority(this.label);
  final String label;
  static Priority fromName(Object? n) => _byName(values, n, Priority.medium);
}

enum LeadSource {
  referral('Referral'),
  walkIn('Walk-in'),
  coldCall('Cold Call'),
  whatsapp('WhatsApp'),
  socialMedia('Social Media'),
  website('Website'),
  existingCustomer('Existing Customer'),
  event('Event'),
  businessCard('Business Card'),
  other('Other');

  const LeadSource(this.label);
  final String label;
  static LeadSource fromName(Object? n) => _byName(values, n, LeadSource.other);
}

enum FollowupStatus {
  pending,
  completed,
  cancelled;

  static FollowupStatus fromName(Object? n) => _byName(values, n, FollowupStatus.pending);
}

enum CallOutcome {
  interested('Interested'),
  callBack('Call Back'),
  noAnswer('No Answer'),
  rejected('Rejected'),
  wrongNumber('Wrong Number');

  const CallOutcome(this.label);
  final String label;
  static CallOutcome fromName(Object? n) => _byName(values, n, CallOutcome.noAnswer);
}

enum DocumentType {
  emiratesId('Emirates ID'),
  passport('Passport'),
  visa('Visa'),
  salaryCertificate('Salary Certificate'),
  bankStatement('Bank Statement'),
  labourContract('Labour Contract'),
  custom('Custom');

  const DocumentType(this.label);
  final String label;
  static DocumentType fromName(Object? n) => _byName(values, n, DocumentType.custom);

  /// The six documents every application needs.
  static const required = [
    emiratesId,
    passport,
    visa,
    salaryCertificate,
    bankStatement,
    labourContract,
  ];
}

enum DocumentStatus {
  pending('Pending'),
  received('Received'),
  verified('Verified'),
  rejected('Rejected');

  const DocumentStatus(this.label);
  final String label;
  static DocumentStatus fromName(Object? n) => _byName(values, n, DocumentStatus.pending);
  bool get isCollected => this == received || this == verified;
}

enum ActivityType {
  created,
  updated,
  statusChanged,
  call,
  whatsapp,
  followupScheduled,
  followupCompleted,
  document,
  voiceNote,
  merged,
  report;

  static ActivityType fromName(Object? n) => _byName(values, n, ActivityType.updated);
}

enum SecurityEventType {
  unlockSuccess('Unlocked'),
  failedPin('Wrong PIN'),
  failedPattern('Wrong pattern'),
  failedBiometric('Biometric failed'),
  failedRecovery('Wrong recovery code'),
  lockout('Locked out'),
  pinChanged('PIN changed'),
  recoveryUsed('Recovery code used');

  const SecurityEventType(this.label);
  final String label;
  static SecurityEventType fromName(Object? n) => _byName(values, n, SecurityEventType.failedPin);
}
