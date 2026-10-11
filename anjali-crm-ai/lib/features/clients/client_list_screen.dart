import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/phone_utils.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../calls/call_actions.dart';
import '../whatsapp/whatsapp_button.dart';
import 'client_form_screen.dart';
import 'client_profile_screen.dart';

/// Sort orders offered by the list.
enum ClientSort {
  updated('Recently updated'),
  name('Name A–Z'),
  score('Lead score'),
  followup('Next followup');

  const ClientSort(this.label);
  final String label;
}

/// Searchable, filterable client list.
class ClientListScreen extends ConsumerStatefulWidget {
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
  ConsumerState<ClientListScreen> createState() => _ClientListScreenState();
}

class _ClientListScreenState extends ConsumerState<ClientListScreen> {
  final _search = TextEditingController();
  late LeadStatus? _status = widget.initialStatus;
  String? _productId;
  Priority? _priority;
  ClientSort _sort = ClientSort.updated;

  /// Ids swiped away whose soft-delete has not reached the stream yet.
  final _hidden = <String>{};

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<Client> _apply(List<Client> all, Map<String, int> scores) {
    final q = _search.text.trim().toLowerCase();
    final qDigits = PhoneUtils.digits(q);
    final list = all.where((c) {
      if (_hidden.contains(c.id)) return false;
      if (_status != null && c.status != _status) return false;
      if (_productId != null && c.productId != _productId) return false;
      if (_priority != null && c.priority != _priority) return false;
      if (widget.filter != null && !widget.filter!(c)) return false;
      if (q.isEmpty) return true;
      return c.name.toLowerCase().contains(q) ||
          (c.company ?? '').toLowerCase().contains(q) ||
          (c.email ?? '').toLowerCase().contains(q) ||
          (c.location ?? '').toLowerCase().contains(q) ||
          (qDigits.length >= 3 && (PhoneUtils.digits(c.phone).contains(qDigits) || PhoneUtils.digits(c.whatsapp ?? '').contains(qDigits)));
    }).toList();
    final far = DateTime(9999);
    list.sort(switch (_sort) {
      ClientSort.updated => (a, b) => b.updatedAt.compareTo(a.updatedAt),
      ClientSort.name => (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
      ClientSort.score => (a, b) => (scores[b.id] ?? 0).compareTo(scores[a.id] ?? 0),
      ClientSort.followup => (a, b) => (a.nextFollowupAt ?? far).compareTo(b.nextFollowupAt ?? far),
    });
    return list;
  }

  Future<void> _delete(Client c) async {
    setState(() => _hidden.add(c.id));
    final actions = ref.read(crmActionsProvider);
    await actions.deleteClient(c);
    if (!mounted) return;
    showSnack(
      context,
      '${c.name} deleted',
      action: SnackBarAction(
        label: 'Undo',
        onPressed: () async {
          await actions.restoreClient(c);
          if (mounted) setState(() => _hidden.remove(c.id));
        },
      ),
    );
  }

  Future<void> _openFilters() async {
    final products = (ref.read(productsProvider).value ?? const []).where((p) => p.active || p.id == _productId).toList();
    String? product = _productId;
    Priority? priority = _priority;
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Filters', style: Theme.of(c).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 16),
                DropdownButtonFormField<String?>(
                  initialValue: product,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Product'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All products')),
                    for (final p in products) DropdownMenuItem(value: p.id, child: Text(p.name, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (v) => set(() => product = v),
                ),
                const SizedBox(height: 16),
                Text('Priority', style: Theme.of(c).textTheme.labelLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(label: const Text('Any'), selected: priority == null, onSelected: (_) => set(() => priority = null)),
                    for (final p in Priority.values)
                      ChoiceChip(
                        label: Text(p.label),
                        selected: priority == p,
                        selectedColor: AppColors.priority(p).withValues(alpha: .2),
                        onSelected: (_) => set(() => priority = p),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          product = null;
                          priority = null;
                          Navigator.pop(c, true);
                        },
                        child: const Text('Clear'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Apply'))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (applied == true) {
      setState(() {
        _productId = product;
        _priority = priority;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(clientsProvider);
    final scores = ref.watch(scoresProvider);
    final products = ref.watch(productNamesProvider);
    final now = ref.watch(nowProvider);
    final clients = _apply(async.value ?? const [], scores);
    final filtersActive = _productId != null || _priority != null;

    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Search name, phone, company…',
                    prefixIcon: const Icon(Icons.search_rounded),
                    isDense: true,
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Clear',
                            onPressed: () => setState(_search.clear),
                            icon: const Icon(Icons.close_rounded),
                          ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Filters',
                onPressed: _openFilters,
                icon: Badge(isLabelVisible: filtersActive, child: const Icon(Icons.tune_rounded)),
              ),
              PopupMenuButton<ClientSort>(
                tooltip: 'Sort',
                icon: const Icon(Icons.sort_rounded),
                initialValue: _sort,
                onSelected: (s) => setState(() => _sort = s),
                itemBuilder: (_) => [for (final s in ClientSort.values) CheckedPopupMenuItem(value: s, checked: s == _sort, child: Text(s.label))],
              ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            children: [
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(label: const Text('All'), selected: _status == null, onSelected: (_) => setState(() => _status = null)),
              ),
              for (final s in LeadStatus.values)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(s.label),
                    selected: _status == s,
                    selectedColor: AppColors.status(s).withValues(alpha: .22),
                    onSelected: (_) => setState(() => _status = _status == s ? null : s),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: async.isLoading && !async.hasValue
              ? const Center(child: CircularProgressIndicator())
              : clients.isEmpty
                  ? EmptyState(
                      icon: Icons.people_outline_rounded,
                      title: (async.value ?? const []).isEmpty ? 'No clients yet' : 'No matching clients',
                      message: (async.value ?? const []).isEmpty ? 'Add your first lead to get started.' : 'Try another search or filter.',
                      action: 'Add lead',
                      onAction: _addLead,
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 96),
                      itemCount: clients.length,
                      itemBuilder: (_, i) {
                        final c = clients[i];
                        return Dismissible(
                          key: ValueKey('client-${c.id}'),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            alignment: Alignment.centerRight,
                            margin: const EdgeInsets.symmetric(vertical: 5),
                            padding: const EdgeInsets.only(right: 24),
                            decoration: BoxDecoration(color: AppColors.danger, borderRadius: BorderRadius.circular(20)),
                            child: const Icon(Icons.delete_rounded, color: Colors.white),
                          ),
                          onDismissed: (_) => _delete(c),
                          child: ClientCard(
                            client: c,
                            productName: products[c.productId],
                            score: scores[c.id] ?? 0,
                            now: now,
                          ),
                        );
                      },
                    ),
        ),
      ],
    );

    final scaffold = Scaffold(
      backgroundColor: widget.embedded ? Colors.transparent : null,
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        backgroundColor: widget.embedded ? Colors.transparent : null,
        title: Text(widget.title ?? 'Clients'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(child: Text('${clients.length}', style: Theme.of(context).textTheme.titleMedium)),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: widget.embedded ? 'clients-fab' : null,
        onPressed: _addLead,
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Add lead'),
      ),
      body: body,
    );
    return widget.embedded ? TabBackground(image: AppAssets.tabBackgrounds[1], child: scaffold) : scaffold;
  }

  void _addLead() => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClientFormScreen()));
}

/// One client in the list: avatar, key facts, call and WhatsApp actions.
class ClientCard extends ConsumerWidget {
  const ClientCard({super.key, required this.client, required this.score, required this.now, this.productName});
  final Client client;
  final String? productName;
  final int score;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = client;
    final t = Theme.of(context).textTheme;
    final muted = t.bodySmall?.color;
    final next = c.nextFollowupAt;
    final overdue = next != null && next.isBefore(now);
    final facts = [productName, if (c.monthlySalary != null) '${Fmt.aedCompact(c.monthlySalary)}/mo'].whereType<String>().join(' · ');
    return GlassCard(
      margin: const EdgeInsets.symmetric(vertical: 5),
      padding: const EdgeInsets.fromLTRB(12, 12, 4, 8),
      onTap: () => ClientProfileScreen.open(context, c.id),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PersonAvatar(photoPath: c.photoPath, initials: c.initials, heroTag: 'avatar-${c.id}'),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(c.name, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    if (c.rating > 0) RatingStars(value: c.rating, size: 13),
                  ],
                ),
                if (facts.isNotEmpty)
                  Text(facts, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    StatusChip(c.status, dense: true),
                    if (c.priority == Priority.high || c.priority == Priority.urgent)
                      Pill(label: c.priority.label, color: AppColors.priority(c.priority), dense: true),
                    if (next != null)
                      Pill(
                        label: '${Fmt.dateShort(next)} ${Fmt.time(next)}',
                        color: overdue ? AppColors.danger : AppColors.info,
                        icon: overdue ? Icons.warning_amber_rounded : Icons.event_rounded,
                        dense: true,
                      ),
                  ],
                ),
                Row(
                  children: [
                    WhatsAppIcon(phone: c.phone, client: c, size: 18),
                    Flexible(
                      child: Text(c.phone, style: t.bodySmall?.copyWith(color: muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            children: [
              ScoreBadge(score, size: 32),
              IconButton(
                tooltip: 'Call ${c.name}',
                onPressed: () => startCall(context, ref, c),
                icon: const Icon(Icons.call_rounded, color: AppColors.success),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
