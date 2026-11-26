import 'package:uuid/uuid.dart';

const _uuid = Uuid();

/// New random record id (UUID v4).
String newId() => _uuid.v4();
