// CONTRACT STUB: replaced by the clients feature implementation.
import 'package:flutter/material.dart';

import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';

/// Searchable, filterable client list.
class ClientListScreen extends StatelessWidget {
  const ClientListScreen({super.key, this.initialStatus, this.title, this.filter, this.embedded = false});

  /// Pre-selected status filter chip.
  final LeadStatus? initialStatus;

  /// Optional app-bar title (drill-down from dashboard KPIs).
  final String? title;

  /// Optional extra predicate (e.g. "followups today").
  final bool Function(Client)? filter;

  /// True when shown as the Clients tab (no back button).
  final bool embedded;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
