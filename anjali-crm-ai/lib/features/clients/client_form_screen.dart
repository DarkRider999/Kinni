// CONTRACT STUB: replaced by the clients feature implementation.
import 'package:flutter/material.dart';

import '../../domain/entities/client.dart';

/// Add / edit client form.
class ClientFormScreen extends StatelessWidget {
  const ClientFormScreen({super.key, this.existing, this.embedded = false});

  final Client? existing;

  /// True when shown inside the Add Lead tab (no back button; form resets after save).
  final bool embedded;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
