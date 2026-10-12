import '../../core/utils/phone_utils.dart';
import 'enums.dart';
import 'sync_entity.dart';

/// A lead / customer. The central CRM record.
class Client extends SyncEntity {
  Client({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.deleted,
    required this.name,
    required this.phone,
    this.whatsapp,
    this.email,
    this.photoPath,
    this.location,
    this.latitude,
    this.longitude,
    this.company,
    this.jobTitle,
    this.nationality,
    this.monthlySalary,
    this.productId,
    this.leadSource = LeadSource.other,
    this.status = LeadStatus.newLead,
    this.priority = Priority.medium,
    this.rating = 0,
    this.nextFollowupAt,
    this.remarks,
    this.requestedAmount,
    this.approvedAmount,
    this.disbursedAmount,
    DateTime? statusChangedAt,
    this.wrongNumber = false,
  }) : statusChangedAt = statusChangedAt ?? createdAt;

  final String name;
  final String phone;
  final String? whatsapp;
  final String? email;
  final String? photoPath;
  final String? location;
  final double? latitude;
  final double? longitude;
  final String? company;
  final String? jobTitle;
  final String? nationality;
  final double? monthlySalary;
  final String? productId;
  final LeadSource leadSource;
  final LeadStatus status;
  final Priority priority;
  final int rating;
  final DateTime? nextFollowupAt;
  final String? remarks;
  final double? requestedAmount;
  final double? approvedAmount;
  final double? disbursedAmount;
  final DateTime statusChangedAt;
  final bool wrongNumber;

  /// Normalised phone used for duplicate detection and search.
  String get phoneKey => PhoneUtils.key(phone);
  String? get emailKey => (email == null || email!.trim().isEmpty) ? null : email!.trim().toLowerCase();
  String get whatsappNumber => (whatsapp == null || whatsapp!.trim().isEmpty) ? phone : whatsapp!;
  bool get hasLocation => latitude != null && longitude != null;
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  static const _unset = Object();

  Client copyWith({
    DateTime? updatedAt,
    bool? deleted,
    String? name,
    String? phone,
    Object? whatsapp = _unset,
    Object? email = _unset,
    Object? photoPath = _unset,
    Object? location = _unset,
    Object? latitude = _unset,
    Object? longitude = _unset,
    Object? company = _unset,
    Object? jobTitle = _unset,
    Object? nationality = _unset,
    Object? monthlySalary = _unset,
    Object? productId = _unset,
    LeadSource? leadSource,
    LeadStatus? status,
    Priority? priority,
    int? rating,
    Object? nextFollowupAt = _unset,
    Object? remarks = _unset,
    Object? requestedAmount = _unset,
    Object? approvedAmount = _unset,
    Object? disbursedAmount = _unset,
    DateTime? statusChangedAt,
    bool? wrongNumber,
  }) {
    T? pick<T>(Object? v, T? current) => identical(v, _unset) ? current : v as T?;
    return Client(
      id: id,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deleted: deleted ?? this.deleted,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      whatsapp: pick(whatsapp, this.whatsapp),
      email: pick(email, this.email),
      photoPath: pick(photoPath, this.photoPath),
      location: pick(location, this.location),
      latitude: pick(latitude, this.latitude),
      longitude: pick(longitude, this.longitude),
      company: pick(company, this.company),
      jobTitle: pick(jobTitle, this.jobTitle),
      nationality: pick(nationality, this.nationality),
      monthlySalary: pick(monthlySalary, this.monthlySalary),
      productId: pick(productId, this.productId),
      leadSource: leadSource ?? this.leadSource,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      rating: rating ?? this.rating,
      nextFollowupAt: pick(nextFollowupAt, this.nextFollowupAt),
      remarks: pick(remarks, this.remarks),
      requestedAmount: pick(requestedAmount, this.requestedAmount),
      approvedAmount: pick(approvedAmount, this.approvedAmount),
      disbursedAmount: pick(disbursedAmount, this.disbursedAmount),
      statusChangedAt: statusChangedAt ?? this.statusChangedAt,
      wrongNumber: wrongNumber ?? this.wrongNumber,
    );
  }

  @override
  Map<String, dynamic> fieldsToMap() => {
        'name': name,
        'phone': phone,
        'phoneKey': phoneKey,
        'whatsapp': whatsapp,
        'email': email,
        'emailKey': emailKey,
        'photoPath': photoPath,
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
        'company': company,
        'jobTitle': jobTitle,
        'nationality': nationality,
        'monthlySalary': monthlySalary,
        'productId': productId,
        'leadSource': leadSource.name,
        'status': status.name,
        'priority': priority.name,
        'rating': rating,
        'nextFollowupAt': isoOrNull(nextFollowupAt),
        'remarks': remarks,
        'requestedAmount': requestedAmount,
        'approvedAmount': approvedAmount,
        'disbursedAmount': disbursedAmount,
        'statusChangedAt': isoOrNull(statusChangedAt),
        'wrongNumber': wrongNumber,
      };

  factory Client.fromMap(Map m) {
    final created = MapRead.date(m, 'createdAt');
    return Client(
      id: MapRead.str(m, 'id'),
      createdAt: created,
      updatedAt: MapRead.date(m, 'updatedAt', created),
      deleted: MapRead.boolean(m, 'deleted'),
      name: MapRead.str(m, 'name'),
      phone: MapRead.str(m, 'phone'),
      whatsapp: MapRead.strOrNull(m, 'whatsapp'),
      email: MapRead.strOrNull(m, 'email'),
      photoPath: MapRead.strOrNull(m, 'photoPath'),
      location: MapRead.strOrNull(m, 'location'),
      latitude: MapRead.dbl(m, 'latitude'),
      longitude: MapRead.dbl(m, 'longitude'),
      company: MapRead.strOrNull(m, 'company'),
      jobTitle: MapRead.strOrNull(m, 'jobTitle'),
      nationality: MapRead.strOrNull(m, 'nationality'),
      monthlySalary: MapRead.dbl(m, 'monthlySalary'),
      productId: MapRead.strOrNull(m, 'productId'),
      leadSource: LeadSource.fromName(m['leadSource']),
      status: LeadStatus.fromName(m['status']),
      priority: Priority.fromName(m['priority']),
      rating: MapRead.integer(m, 'rating').clamp(0, 5),
      nextFollowupAt: MapRead.dateOrNull(m, 'nextFollowupAt'),
      remarks: MapRead.strOrNull(m, 'remarks'),
      requestedAmount: MapRead.dbl(m, 'requestedAmount'),
      approvedAmount: MapRead.dbl(m, 'approvedAmount'),
      disbursedAmount: MapRead.dbl(m, 'disbursedAmount'),
      statusChangedAt: MapRead.dateOrNull(m, 'statusChangedAt') ?? created,
      wrongNumber: MapRead.boolean(m, 'wrongNumber'),
    );
  }
}
