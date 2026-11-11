import 'package:anjali_crm_ai/domain/entities/client.dart';
import 'package:anjali_crm_ai/domain/entities/enums.dart';
import 'package:anjali_crm_ai/domain/entities/followup.dart';

final t0 = DateTime(2026, 10, 11, 9);

Client client({
  String id = 'c1',
  String name = 'Fatima Khan',
  String phone = '0501234567',
  String? email,
  String? whatsapp,
  LeadStatus status = LeadStatus.newLead,
  Priority priority = Priority.medium,
  int rating = 0,
  double? salary,
  String? productId,
  LeadSource source = LeadSource.other,
  String? location,
  DateTime? created,
  DateTime? updated,
  DateTime? statusChangedAt,
  bool deleted = false,
}) =>
    Client(
      id: id,
      createdAt: created ?? t0,
      updatedAt: updated ?? created ?? t0,
      deleted: deleted,
      name: name,
      phone: phone,
      email: email,
      whatsapp: whatsapp,
      status: status,
      priority: priority,
      rating: rating,
      monthlySalary: salary,
      productId: productId,
      leadSource: source,
      location: location,
      statusChangedAt: statusChangedAt,
    );

Followup followup({
  String id = 'f1',
  String clientId = 'c1',
  required DateTime due,
  FollowupStatus status = FollowupStatus.pending,
  DateTime? completedAt,
}) =>
    Followup(id: id, createdAt: t0, updatedAt: t0, clientId: clientId, dueAt: due, status: status, completedAt: completedAt);
