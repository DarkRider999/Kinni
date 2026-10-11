import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/launcher_service.dart';
import '../../core/widgets/common.dart';
import '../../domain/entities/client.dart';
import '../../providers/crm_actions.dart';

const whatsappGreen = Color(0xFF25D366);

/// Opens a direct WhatsApp chat with [phone] and logs it on the client.
Future<void> openWhatsApp(BuildContext context, WidgetRef ref, String phone, {Client? client}) async {
  final ok = await Launcher.whatsapp(phone);
  if (!context.mounted) return;
  if (!ok) {
    showSnack(context, 'WhatsApp is not installed', error: true);
    return;
  }
  if (client != null) await ref.read(crmActionsProvider).logWhatsApp(client);
}

/// Small green icon shown in front of every phone number: tap to message
/// that number directly on WhatsApp.
class WhatsAppIcon extends ConsumerWidget {
  const WhatsAppIcon({super.key, required this.phone, this.client, this.size = 20});
  final String phone;
  final Client? client;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) => IconButton(
        tooltip: 'WhatsApp $phone',
        visualDensity: VisualDensity.compact,
        onPressed: () => openWhatsApp(context, ref, phone, client: client),
        icon: Icon(Icons.chat_rounded, color: whatsappGreen, size: size),
      );
}

/// A phone number row with WhatsApp (and optional call) actions.
class PhoneWithActions extends ConsumerWidget {
  const PhoneWithActions({super.key, required this.phone, this.client, this.label, this.onCall});
  final String phone;
  final Client? client;
  final String? label;
  final VoidCallback? onCall;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          WhatsAppIcon(phone: phone, client: client),
          Flexible(
            child: Text(label == null ? phone : '$label  $phone', overflow: TextOverflow.ellipsis),
          ),
          if (onCall != null)
            IconButton(
              tooltip: 'Call $phone',
              visualDensity: VisualDensity.compact,
              onPressed: onCall,
              icon: const Icon(Icons.call_rounded, size: 20),
            ),
        ],
      );
}
