import 'dart:math';

import '../../core/utils/id.dart';
import '../../domain/entities/activity.dart';
import '../../domain/entities/call_log.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/followup.dart';
import '../../domain/entities/product.dart';

/// Realistic demo data so the dashboard, charts and AI insights have
/// something to show on day one. Every sample record is tagged in
/// `remarks` with [marker] so "Clear sample data" removes only these.
class SampleBundle {
  SampleBundle(this.clients, this.followups, this.calls, this.documents, this.activities);
  final List<Client> clients;
  final List<Followup> followups;
  final List<CallLog> calls;
  final List<ClientDocument> documents;
  final List<Activity> activities;
}

abstract final class SampleData {
  static const marker = '[sample]';

  static const _names = [
    'Fatima Al Mansoori', 'Ahmed Khan', 'Priya Nair', 'Omar Haddad', 'Rahul Menon', 'Aisha Rahman',
    'Mohammed Saeed', 'Sneha Pillai', 'Yousef Darwish', 'Maria Santos', 'Arjun Sharma', 'Layla Hassan',
    'Ravi Kumar', 'Noura Al Ketbi', 'John Mathew', 'Zainab Ali', 'Imran Qureshi', 'Deepa Varghese',
    'Khalid Al Hashmi', 'Grace Fernandes', 'Vikram Singh', 'Mariam Youssef', 'Sanjay Iyer', 'Hessa Al Suwaidi',
    'Faisal Malik', 'Anita Joseph', 'Tariq Aziz', 'Reem Abdullah', 'Suresh Babu', 'Lina Karam',
  ];
  static const _companies = [
    'Emirates Group', 'ADNOC', 'Dubai Holding', 'Etisalat by e&', 'Majid Al Futtaim', 'DP World', 'Aster DM Healthcare',
    'Al Futtaim Motors', 'Lulu Group', 'Emaar Properties', 'du Telecom', 'Dubai Airports', 'RTA Dubai', 'Damac', 'Nakheel',
  ];
  static const _titles = ['Manager', 'Senior Engineer', 'Accountant', 'Sales Executive', 'Nurse', 'Supervisor', 'Analyst', 'Teacher', 'Pilot', 'Consultant'];
  static const _nationalities = ['Emirati', 'Indian', 'Pakistani', 'Filipino', 'Egyptian', 'Jordanian', 'Lebanese', 'British', 'Syrian'];
  static const _locations = <(String, double, double)>[
    ('Dubai Marina', 25.0805, 55.1403), ('Business Bay', 25.1857, 55.2656), ('Deira', 25.2697, 55.3095),
    ('Al Barsha', 25.1132, 55.2004), ('JLT', 25.0693, 55.1415), ('Sharjah', 25.3463, 55.4209),
    ('Abu Dhabi', 24.4539, 54.3773), ('Ajman', 25.4052, 55.5136), ('Mirdif', 25.2196, 55.4207), ('Karama', 25.2440, 55.3044),
  ];

  static SampleBundle generate(List<Product> products, {DateTime? now, int seed = 7}) {
    final rng = Random(seed);
    final t = now ?? DateTime.now();
    final clients = <Client>[];
    final followups = <Followup>[];
    final calls = <CallLog>[];
    final docs = <ClientDocument>[];
    final acts = <Activity>[];

    const statuses = [
      LeadStatus.newLead, LeadStatus.newLead, LeadStatus.newLead, LeadStatus.interested, LeadStatus.interested,
      LeadStatus.interested, LeadStatus.documentsRequested, LeadStatus.documentsRequested, LeadStatus.documentsReceived,
      LeadStatus.applicationSubmitted, LeadStatus.underReview, LeadStatus.approved, LeadStatus.approved,
      LeadStatus.disbursed, LeadStatus.disbursed, LeadStatus.rejected, LeadStatus.notEligible, LeadStatus.notInterested,
    ];

    for (var i = 0; i < _names.length; i++) {
      final created = t.subtract(Duration(days: rng.nextInt(170), hours: rng.nextInt(10)));
      final status = statuses[rng.nextInt(statuses.length)];
      final loc = _locations[rng.nextInt(_locations.length)];
      final salary = (4000 + rng.nextInt(46) * 1000).toDouble();
      final product = products.isEmpty ? null : products[rng.nextInt(products.length)];
      final changed = created.add(Duration(days: rng.nextInt(max(1, t.difference(created).inDays + 1))));
      final requested = ((salary * (6 + rng.nextInt(20))) / 1000).round() * 1000.0;
      final mobile = '05${[0, 2, 4, 5, 6, 8][rng.nextInt(6)]}${1000000 + rng.nextInt(8999999)}';
      final c = Client(
        id: newId(),
        createdAt: created,
        updatedAt: changed.isAfter(t) ? t : changed,
        name: _names[i],
        phone: mobile,
        email: '${_names[i].toLowerCase().split(' ').first}.${i + 1}@example.com',
        location: loc.$1,
        latitude: loc.$2 + (rng.nextDouble() - .5) / 100,
        longitude: loc.$3 + (rng.nextDouble() - .5) / 100,
        company: _companies[rng.nextInt(_companies.length)],
        jobTitle: _titles[rng.nextInt(_titles.length)],
        nationality: _nationalities[rng.nextInt(_nationalities.length)],
        monthlySalary: salary,
        productId: product?.id,
        leadSource: LeadSource.values[rng.nextInt(LeadSource.values.length)],
        status: status,
        priority: Priority.values[rng.nextInt(Priority.values.length)],
        rating: 1 + rng.nextInt(5),
        remarks: '$marker Interested in ${product?.name ?? 'financing'}.',
        requestedAmount: requested,
        approvedAmount: status.isConverted ? requested : null,
        disbursedAmount: status == LeadStatus.disbursed ? requested : null,
        statusChangedAt: changed.isAfter(t) ? t : changed,
      );
      acts.add(Activity(id: newId(), createdAt: created, updatedAt: created, clientId: c.id, type: ActivityType.created, title: 'Lead created', at: created));
      if (status != LeadStatus.newLead) {
        acts.add(Activity(
          id: newId(), createdAt: c.statusChangedAt, updatedAt: c.statusChangedAt, clientId: c.id,
          type: ActivityType.statusChanged, title: 'Status → ${status.label}', fromStatus: LeadStatus.newLead, toStatus: status, at: c.statusChangedAt,
        ));
      }

      // Followups: open leads get one pending (some overdue, some today/upcoming); everyone gets history.
      for (var k = 0; k < 1 + rng.nextInt(3); k++) {
        final done = created.add(Duration(days: 1 + k * 3));
        if (done.isBefore(t)) {
          followups.add(Followup(
            id: newId(), createdAt: created, updatedAt: done, clientId: c.id, dueAt: done,
            note: 'Discuss requirements', status: FollowupStatus.completed, completedAt: done,
          ));
        }
      }
      DateTime? next;
      if (status.isOpen) {
        final offsetHours = [-30, -5, 2, 5, 20, 28, 72, 150, 240][rng.nextInt(9)];
        next = DateTime(t.year, t.month, t.day, t.hour).add(Duration(hours: offsetHours));
        followups.add(Followup(
          id: newId(), createdAt: t, updatedAt: t, clientId: c.id, dueAt: next,
          note: status.isDocumentStage ? 'Collect pending documents' : 'Follow up on ${product?.name ?? 'offer'}',
        ));
      }
      clients.add(next == null ? c : c.copyWith(nextFollowupAt: next));

      // Calls in the last 10 days.
      for (var k = 0; k < rng.nextInt(4); k++) {
        final at = t.subtract(Duration(days: rng.nextInt(10), hours: rng.nextInt(8)));
        calls.add(CallLog(id: newId(), createdAt: at, updatedAt: at, clientId: c.id, calledAt: at, outcome: CallOutcome.values[rng.nextInt(CallOutcome.values.length)]));
      }

      // Documents for leads past "interested".
      if (status.pipelineIndex >= LeadStatus.documentsRequested.pipelineIndex || status == LeadStatus.rejected) {
        for (final type in DocumentType.required) {
          final st = status.pipelineIndex >= LeadStatus.applicationSubmitted.pipelineIndex
              ? DocumentStatus.verified
              : [DocumentStatus.pending, DocumentStatus.received, DocumentStatus.pending][rng.nextInt(3)];
          docs.add(ClientDocument(id: newId(), createdAt: created, updatedAt: c.statusChangedAt, clientId: c.id, type: type, status: st));
        }
      }
    }
    return SampleBundle(clients, followups, calls, docs, acts);
  }
}
