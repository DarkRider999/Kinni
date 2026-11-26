import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../domain/entities/document_category.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import 'settings_widgets.dart';

/// Settings → Document Categories: add, rename, delete and reorder the
/// folders every client's Document Vault uses.
class DocumentCategoriesScreen extends ConsumerWidget {
  const DocumentCategoriesScreen({super.key});

  Future<String?> _name(BuildContext context, {String? initial, required String title}) {
    final c = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, autofocus: true, textCapitalization: TextCapitalization.words),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Save')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cats = ref.watch(categoriesProvider).value ?? const <DocumentCategory>[];
    final actions = ref.read(crmActionsProvider);
    return SettingsScaffold(
      title: 'Document Categories',
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.create_new_folder_rounded),
        label: const Text('Add category'),
        onPressed: () async {
          final n = await _name(context, title: 'New category');
          if (n == null || n.isEmpty) return;
          if (cats.any((c) => c.name.toLowerCase() == n.toLowerCase())) {
            if (context.mounted) showSnack(context, 'That category already exists', error: true);
            return;
          }
          await actions.addCategory(n);
        },
      ),
      body: ReorderableListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        itemCount: cats.length,
        onReorderItem: (from, to) {
          final list = [...cats];
          final item = list.removeAt(from);
          list.insert(to, item);
          actions.reorderCategories(list);
        },
        itemBuilder: (context, i) {
          final c = cats[i];
          return Padding(
            key: ValueKey(c.id),
            padding: const EdgeInsets.only(bottom: 8),
            child: GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.folder_rounded),
                title: Text(c.name),
                subtitle: c.supportsExpiry ? const Text('Tracks expiry date') : null,
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  PopupMenuButton<String>(
                    onSelected: (v) async {
                      switch (v) {
                        case 'rename':
                          final n = await _name(context, initial: c.name, title: 'Rename category');
                          if (n != null && n.isNotEmpty) await actions.saveCategory(c.copyWith(name: n));
                        case 'expiry':
                          await actions.saveCategory(c.copyWith(supportsExpiry: !c.supportsExpiry));
                        case 'delete':
                          if (await confirm(context,
                              title: 'Delete "${c.name}"?',
                              message: 'Documents in this category move to "Other Documents". Nothing is deleted.',
                              ok: 'Delete',
                              destructive: true)) {
                            await actions.deleteCategory(c);
                          }
                      }
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'rename', child: Text('Rename')),
                      PopupMenuItem(value: 'expiry', child: Text(c.supportsExpiry ? 'Stop asking for expiry' : 'Ask for expiry date')),
                      if (c.id != DocumentCategory.other) const PopupMenuItem(value: 'delete', child: Text('Delete')),
                    ],
                  ),
                  ReorderableDragStartListener(index: i, child: const Icon(Icons.drag_handle_rounded)),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}
