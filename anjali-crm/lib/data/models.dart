/// Domain model for the lead CRM described in the Anjali CRM AI user guide.
library;

/// Where a lead is in the sales pipeline (guide §8 "Pipeline", §5 cards).
/// [key] is what the database stores; never change an existing key.
enum LeadStatus {
  newLead('new_lead', 'New Lead'),
  interested('interested', 'Interested'),
  documentsRequested('documents_requested', 'Documents Requested'),
  documentsReceived('documents_received', 'Documents Received'),
  applicationSubmitted('application_submitted', 'Application Submitted'),
  approved('approved', 'Approved'),
  disbursed('disbursed', 'Disbursed'),
  rejected('rejected', 'Rejected'),
  notInterested('not_interested', 'Not Interested'),
  notEligible('not_eligible', 'Not Eligible');

  const LeadStatus(this.key, this.label);
  final String key;
  final String label;

  static LeadStatus fromKey(String? key) =>
      values.firstWhere((s) => s.key == key, orElse: () => LeadStatus.newLead);

  /// The forward path shown on the profile's pipeline bar.
  static const pipeline = [
    newLead,
    interested,
    documentsRequested,
    documentsReceived,
    applicationSubmitted,
    approved,
    disbursed,
  ];

  /// Lead is finished (won or lost); no more chasing needed.
  bool get isClosed => this == disbursed || isLost;
  bool get isLost => this == rejected || this == notInterested || this == notEligible;

  /// Moving to this status asks for an amount in AED (guide §8).
  bool get needsAmount => this == approved || this == disbursed;
}

enum Priority {
  low('low', 'Low'),
  medium('medium', 'Medium'),
  high('high', 'High');

  const Priority(this.key, this.label);
  final String key;
  final String label;

  static Priority fromKey(String? key) =>
      values.firstWhere((p) => p.key == key, orElse: () => Priority.medium);
}

/// Lead sources offered on the lead form.
const leadSources = [
  'Referral',
  'Walk-in',
  'Cold call',
  'WhatsApp',
  'Social media',
  'Website',
  'Existing customer',
  'Other',
];

/// Call outcomes offered after a call (guide §13).
const callOutcomes = [
  'Answered - interested',
  'Answered - call back',
  'Answered - not interested',
  'No answer',
  'Busy',
  'Switched off',
  'Wrong number',
];

/// The outcome that asks for a callback time and creates a followup.
const callBackOutcome = 'Answered - call back';
const wrongNumberOutcome = 'Wrong number';

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.requiredDocs,
    required this.active,
    required this.sortOrder,
  });

  final int id;
  final String name;

  /// Document folder names this product needs (drives the vault checklist).
  final List<String> requiredDocs;
  final bool active;
  final int sortOrder;

  factory Product.fromRow(Map<String, Object?> r) => Product(
        id: r['id'] as int,
        name: r['name'] as String,
        requiredDocs: (r['required_docs'] as String)
            .split('|')
            .where((s) => s.isNotEmpty)
            .toList(),
        active: r['active'] == 1,
        sortOrder: r['sort_order'] as int,
      );
}

class Client {
  const Client({
    this.id,
    required this.name,
    required this.phone,
    this.whatsapp = '',
    this.email = '',
    this.location = '',
    this.company = '',
    this.jobTitle = '',
    this.nationality = '',
    this.salary,
    this.requestedAmount,
    this.approvedAmount,
    this.disbursedAmount,
    this.productId,
    this.productName,
    this.source = '',
    this.status = LeadStatus.newLead,
    this.priority = Priority.medium,
    this.rating = 0,
    this.remarks = '',
    this.isSample = false,
    this.createdAt,
    this.updatedAt,
    this.nextFollowupAt,
  });

  final int? id;
  final String name;
  final String phone;

  /// Empty means "same as phone".
  final String whatsapp;
  final String email;
  final String location;
  final String company;
  final String jobTitle;
  final String nationality;

  /// Monthly salary and amounts are AED.
  final double? salary;
  final double? requestedAmount;
  final double? approvedAmount;
  final double? disbursedAmount;
  final int? productId;

  /// Joined from products; read-only.
  final String? productName;
  final String source;
  final LeadStatus status;
  final Priority priority;

  /// 0 (unrated) to 5 stars.
  final int rating;
  final String remarks;
  final bool isSample;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Earliest open followup; joined, read-only.
  final DateTime? nextFollowupAt;

  String get whatsappNumber => whatsapp.trim().isEmpty ? phone : whatsapp;

  factory Client.fromRow(Map<String, Object?> r) => Client(
        id: r['id'] as int,
        name: r['name'] as String,
        phone: r['phone'] as String,
        whatsapp: r['whatsapp'] as String,
        email: r['email'] as String,
        location: r['location'] as String,
        company: r['company'] as String,
        jobTitle: r['job_title'] as String,
        nationality: r['nationality'] as String,
        salary: (r['salary'] as num?)?.toDouble(),
        requestedAmount: (r['requested_amount'] as num?)?.toDouble(),
        approvedAmount: (r['approved_amount'] as num?)?.toDouble(),
        disbursedAmount: (r['disbursed_amount'] as num?)?.toDouble(),
        productId: r['product_id'] as int?,
        productName: r['product_name'] as String?,
        source: r['source'] as String,
        status: LeadStatus.fromKey(r['status'] as String?),
        priority: Priority.fromKey(r['priority'] as String?),
        rating: r['rating'] as int,
        remarks: r['remarks'] as String,
        isSample: r['is_sample'] == 1,
        createdAt: _date(r['created_at']),
        updatedAt: _date(r['updated_at']),
        nextFollowupAt: _date(r['next_followup_at']),
      );

  /// Columns written on insert/update (ids, joins and timestamps excluded).
  Map<String, Object?> toRow() => {
        'name': name.trim(),
        'phone': phone.trim(),
        'whatsapp': whatsapp.trim(),
        'email': email.trim(),
        'location': location.trim(),
        'company': company.trim(),
        'job_title': jobTitle.trim(),
        'nationality': nationality.trim(),
        'salary': salary,
        'requested_amount': requestedAmount,
        'approved_amount': approvedAmount,
        'disbursed_amount': disbursedAmount,
        'product_id': productId,
        'source': source,
        'status': status.key,
        'priority': priority.key,
        'rating': rating,
        'remarks': remarks.trim(),
        'is_sample': isSample ? 1 : 0,
      };
}

class Followup {
  const Followup({
    this.id,
    required this.clientId,
    required this.dueAt,
    this.note = '',
    this.completedAt,
    this.outcome = '',
    this.clientName,
    this.clientPhone,
  });

  final int? id;

  /// Null only for activities migrated from version 1 that had no contact.
  final int? clientId;
  final DateTime dueAt;
  final String note;
  final DateTime? completedAt;
  final String outcome;

  /// Joined from clients; read-only.
  final String? clientName;
  final String? clientPhone;

  bool get isDone => completedAt != null;
  bool isOverdue(DateTime now) => !isDone && dueAt.isBefore(now);

  factory Followup.fromRow(Map<String, Object?> r) => Followup(
        id: r['id'] as int,
        clientId: r['client_id'] as int?,
        dueAt: DateTime.parse(r['due_at'] as String),
        note: r['note'] as String,
        completedAt: _date(r['completed_at']),
        outcome: r['outcome'] as String,
        clientName: r['client_name'] as String?,
        clientPhone: r['client_phone'] as String?,
      );
}

class CallLog {
  const CallLog({required this.id, required this.clientId, required this.calledAt, required this.outcome, required this.notes});

  final int id;
  final int clientId;
  final DateTime calledAt;
  final String outcome;
  final String notes;

  factory CallLog.fromRow(Map<String, Object?> r) => CallLog(
        id: r['id'] as int,
        clientId: r['client_id'] as int,
        calledAt: DateTime.parse(r['called_at'] as String),
        outcome: r['outcome'] as String,
        notes: r['notes'] as String,
      );
}

/// Kinds of timeline entry (guide §8 "Timeline tab").
enum TimelineKind { created, statusChanged, call, followupAdded, followupDone, note, edited }

class TimelineEvent {
  const TimelineEvent({required this.id, required this.clientId, required this.at, required this.kind, required this.title, required this.detail});

  final int id;
  final int clientId;
  final DateTime at;
  final TimelineKind kind;
  final String title;
  final String detail;

  factory TimelineEvent.fromRow(Map<String, Object?> r) => TimelineEvent(
        id: r['id'] as int,
        clientId: r['client_id'] as int,
        at: DateTime.parse(r['at'] as String),
        kind: TimelineKind.values.firstWhere((k) => k.name == r['kind'], orElse: () => TimelineKind.note),
        title: r['title'] as String,
        detail: r['detail'] as String,
      );
}

DateTime? _date(Object? v) => v is String && v.isNotEmpty ? DateTime.parse(v) : null;
