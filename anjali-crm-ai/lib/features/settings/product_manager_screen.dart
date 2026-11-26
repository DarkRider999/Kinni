import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/product_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/id.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../data/seed/defaults.dart';
import '../../domain/entities/document_category.dart';
import '../../domain/entities/product.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import 'settings_widgets.dart';

/// List, add, edit, reorder and delete loan products (FR-SET).
class ProductManagerScreen extends ConsumerWidget {
  const ProductManagerScreen({super.key});

  Future<void> _edit(BuildContext context, WidgetRef ref, List<Product> all, [Product? product]) async {
    final result = await showDialog<Product>(context: context, builder: (_) => _ProductDialog(product: product, all: all, categories: ref.read(categoriesProvider).value ?? const []));
    if (result == null) return;
    await ref.read(crmActionsProvider).saveProduct(result);
    if (context.mounted) showSnack(context, product == null ? '${result.name} added' : '${result.name} saved');
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, Product p) async {
    final ok = await confirm(context,
        title: 'Delete ${p.name}?',
        message: 'Existing clients keep their records, but this product will no longer be offered. You can hide it instead by turning it inactive.',
        ok: 'Delete',
        destructive: true);
    if (!ok) return;
    await ref.read(crmActionsProvider).deleteProduct(p);
    if (context.mounted) showSnack(context, '${p.name} deleted');
  }

  Future<void> _reorder(WidgetRef ref, List<Product> list, int oldIndex, int newIndex) async {
    final items = List.of(list);
    items.insert(newIndex, items.removeAt(oldIndex));
    final actions = ref.read(crmActionsProvider);
    for (var i = 0; i < items.length; i++) {
      if (items[i].sortOrder != i) await actions.saveProduct(items[i].copyWith(sortOrder: i));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(productsProvider).value ?? const <Product>[];
    return SettingsScaffold(
      title: 'Products',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(context, ref, products),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add product'),
      ),
      body: products.isEmpty
          ? EmptyState(
              icon: Icons.inventory_2_outlined,
              title: 'No products yet',
              message: 'Add the loan products you sell.',
              action: 'Add product',
              onAction: () => _edit(context, ref, products))
          : ReorderableListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              header: const SettingsNote('Long-press and drag to reorder. Inactive products are hidden from new leads.'),
              itemCount: products.length,
              onReorderItem: (o, n) => _reorder(ref, products, o, n),
              itemBuilder: (_, i) {
                final p = products[i];
                final color = Color(p.colorValue);
                return Padding(
                  key: ValueKey(p.id),
                  padding: const EdgeInsets.only(bottom: 8),
                  child: GlassCard(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    onTap: () => _edit(context, ref, products, p),
                    child: ListTile(
                      leading: SettingsIcon(icon: ProductIcons.of(p.iconCode), color: color),
                      title: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(p.active ? 'Active' : 'Inactive'),
                      trailing: IconButton(
                        tooltip: 'Delete',
                        icon: const Icon(Icons.delete_outline_rounded),
                        onPressed: () => _delete(context, ref, p),
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _ProductDialog extends StatefulWidget {
  const _ProductDialog({this.product, required this.all, required this.categories});
  final Product? product;
  final List<Product> all;

  /// Vault categories offered for the required-documents checklist.
  final List<DocumentCategory> categories;

  @override
  State<_ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<_ProductDialog> {
  late final _name = TextEditingController(text: widget.product?.name ?? '');
  late int _icon = widget.product == null ? ProductIcons.all.first.codePoint : ProductIcons.of(widget.product!.iconCode).codePoint;
  late int _color = widget.product?.colorValue ?? AppColors.chart.first.toARGB32();
  late bool _active = widget.product?.active ?? true;

  /// Required documents; null until edited, so a new product follows its name.
  late Set<String>? _required = (widget.product?.requiredCategoryIds.isNotEmpty ?? false) ? {...widget.product!.requiredCategoryIds} : null;
  Set<String> get _checklist => _required ?? {...Defaults.requiredFor(_name.text)};
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _save() {
    final name = _name.text.trim();
    if (name.length < 2) return setState(() => _error = 'Enter at least 2 characters');
    final clash = widget.all.any((p) => p.id != widget.product?.id && p.name.trim().toLowerCase() == name.toLowerCase());
    if (clash) return setState(() => _error = 'A product with this name already exists');
    final old = widget.product;
    final now = DateTime.now();
    final result = old == null
        ? Product(
            id: newId(),
            createdAt: now,
            updatedAt: now,
            name: name,
            iconCode: _icon,
            colorValue: _color,
            active: _active,
            requiredCategoryIds: _orderedChecklist(),
            sortOrder: widget.all.isEmpty ? 0 : widget.all.map((p) => p.sortOrder).reduce((a, b) => a > b ? a : b) + 1)
        : old.copyWith(name: name, iconCode: _icon, colorValue: _color, active: _active, requiredCategoryIds: _orderedChecklist());
    Navigator.pop(context, result);
  }

  /// Checklist in vault-folder order.
  List<String> _orderedChecklist() => [for (final c in widget.categories) if (_checklist.contains(c.id)) c.id];

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.product == null ? 'New product' : 'Edit product'),
        content: SizedBox(
          width: 340,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              TextField(
                controller: _name,
                autofocus: widget.product == null,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: 'Name', errorText: _error),
                onChanged: (_) => setState(() => _error = null),
              ),
              const SizedBox(height: 16),
              const Text('Icon', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final ic in ProductIcons.all)
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => setState(() => _icon = ic.codePoint),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        color: _icon == ic.codePoint ? Color(_color).withValues(alpha: .18) : null,
                        border: Border.all(color: _icon == ic.codePoint ? Color(_color) : Colors.transparent, width: 1.5),
                      ),
                      child: Icon(ic, size: 22, color: _icon == ic.codePoint ? Color(_color) : null),
                    ),
                  ),
              ]),
              const SizedBox(height: 16),
              const Text('Colour', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final c in AppColors.chart)
                  GestureDetector(
                    onTap: () => setState(() => _color = c.toARGB32()),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: c,
                        shape: BoxShape.circle,
                        border: Border.all(color: _color == c.toARGB32() ? Theme.of(context).colorScheme.onSurface : Colors.transparent, width: 2.5),
                      ),
                      child: _color == c.toARGB32() ? const Icon(Icons.check_rounded, color: Colors.white, size: 18) : null,
                    ),
                  ),
              ]),
              const SizedBox(height: 16),
              const Text('Required documents', style: TextStyle(fontWeight: FontWeight.w700)),
              const Text('Shown as this product\'s checklist with completion %.', style: TextStyle(fontSize: 12)),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final c in widget.categories)
                  FilterChip(
                    label: Text(c.name),
                    selected: _checklist.contains(c.id),
                    onSelected: (on) => setState(() {
                      final next = {..._checklist};
                      on ? next.add(c.id) : next.remove(c.id);
                      _required = next;
                    }),
                  ),
              ]),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Active'),
                subtitle: const Text('Offered for new leads'),
                value: _active,
                onChanged: (v) => setState(() => _active = v),
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: _save, child: const Text('Save')),
        ],
      );
}
