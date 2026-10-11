// CONTRACT STUB: replaced by the clients feature implementation.
import 'package:flutter/material.dart';

/// Full customer profile.
class ClientProfileScreen extends StatelessWidget {
  const ClientProfileScreen({super.key, required this.clientId});
  final String clientId;

  /// Pushes the profile for [clientId].
  static Future<void> open(BuildContext context, String clientId) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientProfileScreen(clientId: clientId)));

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
