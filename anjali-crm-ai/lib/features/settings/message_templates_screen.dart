import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../domain/entities/message_template.dart';
import '../../domain/services/template_renderer.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../tts/speak_button.dart';
import 'settings_widgets.dart';

/// Settings → Message Templates: create, edit, delete, duplicate, set
/// default and reorder an unlimited number of WhatsApp templates.
class MessageTemplatesScreen extends ConsumerWidget {
  const MessageTemplatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final templates = ref.watch(templatesProvider).value ?? const <MessageTemplate>[];
    final actions = ref.read(crmActionsProvider);
    return SettingsScaffold(
      title: 'Message Templates',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => TemplateEditorScreen.open(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New template'),
      ),
      body: templates.isEmpty
          ? const EmptyState(icon: Icons.textsms_outlined, title: 'No templates yet', message: 'Tap "New template" to create one.')
          : ReorderableListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: templates.length,
              onReorderItem: (from, to) {
                final list = [...templates];
                final item = list.removeAt(from);
                list.insert(to, item);
                actions.reorderTemplates(list);
              },
              itemBuilder: (context, i) {
                final t = templates[i];
                return Padding(
                  key: ValueKey(t.id),
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GlassCard(
                    onTap: () => TemplateEditorScreen.open(context, template: t),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Flexible(child: Text(t.name, style: const TextStyle(fontWeight: FontWeight.w800))),
                            if (t.isDefault) ...[const SizedBox(width: 8), const Pill(label: 'Default', color: AppColors.gold, dense: true, icon: Icons.star_rounded)],
                          ]),
                          const SizedBox(height: 4),
                          Text(t.body, maxLines: 3, overflow: TextOverflow.ellipsis),
                        ]),
                      ),
                      PopupMenuButton<String>(
                        onSelected: (v) async {
                          switch (v) {
                            case 'edit':
                              await TemplateEditorScreen.open(context, template: t);
                            case 'duplicate':
                              await actions.duplicateTemplate(t);
                              if (context.mounted) showSnack(context, 'Duplicated "${t.name}"');
                            case 'default':
                              await actions.setDefaultTemplate(t);
                            case 'delete':
                              if (await confirm(context, title: 'Delete template?', message: t.name, ok: 'Delete', destructive: true)) {
                                await actions.deleteTemplate(t);
                              }
                          }
                        },
                        itemBuilder: (_) => [
                          const PopupMenuItem(value: 'edit', child: Text('Edit')),
                          const PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
                          if (!t.isDefault) const PopupMenuItem(value: 'default', child: Text('Set as default')),
                          const PopupMenuItem(value: 'delete', child: Text('Delete')),
                        ],
                      ),
                      ReorderableDragStartListener(index: i, child: const Padding(padding: EdgeInsets.all(8), child: Icon(Icons.drag_handle_rounded))),
                    ]),
                  ),
                );
              },
            ),
    );
  }
}

/// Create / edit one template with tag shortcuts and a live preview.
class TemplateEditorScreen extends ConsumerStatefulWidget {
  const TemplateEditorScreen({super.key, this.template});
  final MessageTemplate? template;

  static Future<void> open(BuildContext context, {MessageTemplate? template}) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => TemplateEditorScreen(template: template)));

  @override
  ConsumerState<TemplateEditorScreen> createState() => _TemplateEditorScreenState();
}

class _TemplateEditorScreenState extends ConsumerState<TemplateEditorScreen> {
  late final _name = TextEditingController(text: widget.template?.name);
  late final _body = TextEditingController(text: widget.template?.body);
  late bool _default = widget.template?.isDefault ?? false;

  /// Example values for the preview.
  static const _sample = {
    'CustomerName': 'Fatima Khan',
    'ProductName': 'Personal Loan',
    'Phone': '050 123 4567',
    'Location': 'Dubai Marina',
    'Salary': 'AED 15,000',
    'Status': 'Interested',
    'FollowupDate': '14 Oct 2026, 10:00 AM',
  };

  @override
  void dispose() {
    _name.dispose();
    _body.dispose();
    super.dispose();
  }

  void _insertTag(String tag) {
    final sel = _body.selection;
    final text = _body.text;
    final at = sel.isValid ? sel.start : text.length;
    final end = sel.isValid ? sel.end : text.length;
    _body.value = TextEditingValue(text: text.replaceRange(at, end, tag), selection: TextSelection.collapsed(offset: at + tag.length));
    setState(() {});
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final body = _body.text.trim();
    if (name.isEmpty || body.isEmpty) {
      showSnack(context, 'Name and message are required', error: true);
      return;
    }
    final actions = ref.read(crmActionsProvider);
    if (widget.template == null) {
      final t = await actions.createTemplate(name, body);
      if (_default) await actions.setDefaultTemplate(t);
    } else {
      await actions.saveTemplate(widget.template!.copyWith(name: name, body: body, isDefault: _default));
    }
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final preview = TemplateRenderer.render(_body.text, _sample);
    return SettingsPage(
      title: widget.template == null ? 'New template' : 'Edit template',
      actions: [TextButton(onPressed: _save, child: const Text('Save'))],
      children: [
        const SizedBox(height: 8),
        TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Template name')),
        const SizedBox(height: 12),
        TextField(
          controller: _body,
          minLines: 6,
          maxLines: 14,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Message', alignLabelWithHint: true),
        ),
        const SizedBox(height: 8),
        Text('Tap a tag to insert it:', style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [for (final tag in TemplateRenderer.tags) ActionChip(label: Text(tag), onPressed: () => _insertTag(tag))]),
        SwitchListTile(contentPadding: EdgeInsets.zero, value: _default, onChanged: (v) => setState(() => _default = v), title: const Text('Default template')),
        SettingsGroup(
          title: 'Preview',
          icon: Icons.visibility_rounded,
          children: [
            ListTile(
              title: Text(preview.isEmpty ? 'Your message preview appears here.' : preview),
              trailing: SpeakButton(textBuilder: () => preview),
            ),
          ],
        ),
      ],
    );
  }
}
