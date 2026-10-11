import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/services/launcher_service.dart';
import '../../core/widgets/common.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/message_template.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../tts/speak_button.dart';

const whatsappGreen = Color(0xFF25D366);

/// Opens a direct WhatsApp chat (https://wa.me/{phone}) and logs it.
Future<void> openWhatsApp(BuildContext context, WidgetRef ref, String phone, {Client? client, String text = '', String what = 'Chat opened'}) async {
  final ok = await Launcher.whatsapp(phone, text: text);
  if (!context.mounted) return;
  if (!ok) {
    showSnack(context, 'WhatsApp is not installed', error: true);
    return;
  }
  if (client != null) await ref.read(crmActionsProvider).logWhatsApp(client, what: what);
}

/// Shares text through WhatsApp's own contact picker (wa.me/?text=).
Future<bool> _shareTextToWhatsApp(String text) =>
    launchUrl(Uri.https('wa.me', '/', {'text': text}), mode: LaunchMode.externalApplication);

/// WhatsApp hub for one client: open chat, one-tap template send, share
/// the client's details, preview / read the message aloud.
Future<void> showWhatsAppSheet(BuildContext context, WidgetRef ref, Client client, {String? templateName}) async {
  final actions = ref.read(crmActionsProvider);
  final templates = ref.read(templatesProvider).value ?? const <MessageTemplate>[];
  MessageTemplate? selected = templateName == null
      ? templates.where((t) => t.isDefault).firstOrNull
      : templates.where((t) => t.name.toLowerCase() == templateName.toLowerCase()).firstOrNull;
  final text = TextEditingController(text: selected == null ? '' : actions.renderTemplate(selected, client));

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(ctx).bottom + 20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.chat_rounded, color: whatsappGreen),
              const SizedBox(width: 8),
              Expanded(child: Text('WhatsApp · ${client.name}', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: [
              ActionChip(
                avatar: const Icon(Icons.open_in_new_rounded, size: 18, color: whatsappGreen),
                label: const Text('Open chat'),
                onPressed: () {
                  Navigator.pop(ctx);
                  openWhatsApp(context, ref, client.whatsappNumber, client: client);
                },
              ),
              ActionChip(
                avatar: const Icon(Icons.ios_share_rounded, size: 18),
                label: const Text('Share client details'),
                onPressed: () async {
                  Navigator.pop(ctx);
                  final ok = await _shareTextToWhatsApp(actions.clientSummary(client));
                  if (ok) {
                    await actions.logWhatsApp(client, what: 'Client details shared');
                  } else if (context.mounted) {
                    showSnack(context, 'WhatsApp is not installed', error: true);
                  }
                },
              ),
            ]),
            const SizedBox(height: 14),
            Text('Templates', style: Theme.of(ctx).textTheme.labelLarge),
            const SizedBox(height: 6),
            if (templates.isEmpty)
              const Text('No templates yet. Add them in Settings → Message Templates.')
            else
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final t in templates)
                  ChoiceChip(
                    label: Text(t.isDefault ? '★ ${t.name}' : t.name),
                    selected: selected?.id == t.id,
                    onSelected: (_) => setState(() {
                      selected = t;
                      text.text = actions.renderTemplate(t, client);
                    }),
                  ),
              ]),
            const SizedBox(height: 12),
            TextField(
              controller: text,
              minLines: 4,
              maxLines: 10,
              decoration: InputDecoration(
                labelText: 'Message',
                alignLabelWithHint: true,
                suffixIcon: SpeakButton(textBuilder: () => text.text),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: whatsappGreen),
                icon: const Icon(Icons.send_rounded),
                label: const Text('Send on WhatsApp'),
                onPressed: () {
                  Navigator.pop(ctx);
                  openWhatsApp(context, ref, client.whatsappNumber, client: client, text: text.text.trim(), what: selected?.name ?? 'Custom message');
                },
              ),
            ),
          ]),
        ),
      ),
    ),
  );
}

/// Green WhatsApp icon placed in front of every phone number. Tap = direct
/// chat; long-press = templates / share sheet (when a client is known).
class WhatsAppIcon extends ConsumerWidget {
  const WhatsAppIcon({super.key, required this.phone, this.client, this.size = 20});
  final String phone;
  final Client? client;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) => GestureDetector(
        onLongPress: client == null ? null : () => showWhatsAppSheet(context, ref, client!),
        child: IconButton(
          tooltip: 'WhatsApp $phone',
          visualDensity: VisualDensity.compact,
          onPressed: () => openWhatsApp(context, ref, phone, client: client),
          icon: Icon(Icons.chat_rounded, color: whatsappGreen, size: size),
        ),
      );
}

/// A phone number with WhatsApp (and optional call) actions.
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
          Flexible(child: Text(label == null ? phone : '$label  $phone', overflow: TextOverflow.ellipsis)),
          if (onCall != null)
            IconButton(tooltip: 'Call $phone', visualDensity: VisualDensity.compact, onPressed: onCall, icon: const Icon(Icons.call_rounded, size: 20)),
        ],
      );
}
